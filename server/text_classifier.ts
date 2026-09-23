import {
  BibliometricDocument,
  StatisticalClassifierType,
  ModelBenchmarkResult,
  FoldEvaluationResult,
  ClassEvaluationMetrics,
  DistinctiveFeature,
  TextClassificationOutput,
} from "../src/types.js";

// Stopwords tailored for scientific abstracts and titles
const SCIENTIFIC_STOPWORDS = new Set([
  "the", "and", "of", "in", "for", "with", "on", "a", "an", "by", "to", "at", "from",
  "as", "is", "are", "was", "were", "this", "that", "these", "those", "it", "its",
  "or", "be", "we", "our", "using", "based", "approach", "method", "study", "analysis",
  "results", "proposed", "system", "model", "performance", "paper", "presents", "show",
  "data", "experimental", "new", "via", "through", "which", "into", "over", "between",
  "also", "can", "have", "has", "been", "one", "two", "well", "all", "more", "such",
  "both", "due", "high", "low", "first", "used", "different", "towards", "during",
  "under", "while", "out", "then", "up", "than", "other", "some", "may", "about",
  "aim", "furthermore", "however", "conclude", "demonstrate", "evaluated", "applied"
]);

// Helper for seeded pseudo-random numbers (LCG)
class SeededRandom {
  private seed: number;
  constructor(seed: number = 42) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// -------------------------------------------------------------
// 1. Text Tokenizer & TF-IDF Vectorizer with N-Grams
// -------------------------------------------------------------
export function extractCleanTokens(text: string, includeBigrams: boolean = true): string[] {
  if (!text) return [];
  const cleanTokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !SCIENTIFIC_STOPWORDS.has(t) && !/^\d+$/.test(t));

  if (!includeBigrams || cleanTokens.length < 2) {
    return cleanTokens;
  }

  const bigrams: string[] = [];
  for (let i = 0; i < cleanTokens.length - 1; i++) {
    bigrams.push(`${cleanTokens[i]}_${cleanTokens[i + 1]}`);
  }

  return [...cleanTokens, ...bigrams];
}

export class TextTfidfEngine {
  vocabulary: Map<string, number> = new Map();
  reverseVocab: string[] = [];
  idf: number[] = [];

  fitTransform(
    documents: string[][],
    maxFeatures: number = 200,
    minDf: number = 1
  ): number[][] {
    const docCount = documents.length;
    if (docCount === 0) return [];

    // Document frequencies
    const dfMap = new Map<string, number>();
    for (const tokens of documents) {
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        dfMap.set(token, (dfMap.get(token) || 0) + 1);
      }
    }

    // Filter by minDf and select top features
    const sortedTerms = Array.from(dfMap.entries())
      .filter(([_, df]) => df >= minDf)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxFeatures);

    this.vocabulary.clear();
    this.reverseVocab = [];
    this.idf = [];

    sortedTerms.forEach(([term, df], idx) => {
      this.vocabulary.set(term, idx);
      this.reverseVocab.push(term);
      // Smooth IDF formula: ln((1 + N) / (1 + df)) + 1
      this.idf.push(Math.log((1 + docCount) / (1 + df)) + 1);
    });

    const dim = this.reverseVocab.length;

    // Transform and L2-normalize
    return documents.map((tokens) => {
      const vec = new Array(dim).fill(0);
      const tokenCount = tokens.length || 1;

      for (const token of tokens) {
        const idx = this.vocabulary.get(token);
        if (idx !== undefined) {
          vec[idx] += 1 / tokenCount;
        }
      }

      let normSq = 0;
      for (let i = 0; i < dim; i++) {
        vec[i] *= this.idf[i];
        normSq += vec[i] * vec[i];
      }

      const norm = Math.sqrt(normSq) || 1e-9;
      return vec.map((v) => v / norm);
    });
  }

  transform(tokens: string[]): number[] {
    const dim = this.reverseVocab.length;
    const vec = new Array(dim).fill(0);
    const tokenCount = tokens.length || 1;

    for (const token of tokens) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        vec[idx] += 1 / tokenCount;
      }
    }

    let normSq = 0;
    for (let i = 0; i < dim; i++) {
      vec[i] *= this.idf[i];
      normSq += vec[i] * vec[i];
    }

    const norm = Math.sqrt(normSq) || 1e-9;
    return vec.map((v) => v / norm);
  }
}

// -------------------------------------------------------------
// 2. Stratified K-Fold Cross-Validation Splitter
// -------------------------------------------------------------
export interface SplitFold {
  trainIndices: number[];
  valIndices: number[];
}

export function generateStratifiedKFolds(
  labels: number[],
  k: number = 5,
  seed: number = 42
): SplitFold[] {
  const rng = new SeededRandom(seed);
  const classToIndices = new Map<number, number[]>();

  labels.forEach((lbl, idx) => {
    if (!classToIndices.has(lbl)) {
      classToIndices.set(lbl, []);
    }
    classToIndices.get(lbl)!.push(idx);
  });

  // Shuffle indices within each class group
  classToIndices.forEach((indices) => {
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  });

  const folds: SplitFold[] = Array.from({ length: k }, () => ({
    trainIndices: [],
    valIndices: [],
  }));

  // Distribute class samples evenly across folds
  classToIndices.forEach((indices) => {
    indices.forEach((docIdx, pos) => {
      const valFold = pos % k;
      folds[valFold].valIndices.push(docIdx);
      for (let f = 0; f < k; f++) {
        if (f !== valFold) {
          folds[f].trainIndices.push(docIdx);
        }
      }
    });
  });

  return folds;
}

// -------------------------------------------------------------
// 3. Evaluation Metrics Computations
// -------------------------------------------------------------
export function computeClassificationMetrics(
  actual: number[],
  predicted: number[],
  numClasses: number,
  classNames: string[]
): {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  weightedF1: number;
  confusionMatrix: number[][];
  classMetrics: ClassEvaluationMetrics[];
} {
  const n = actual.length;
  if (n === 0) {
    return {
      accuracy: 0,
      macroPrecision: 0,
      macroRecall: 0,
      macroF1: 0,
      weightedF1: 0,
      confusionMatrix: Array.from({ length: numClasses }, () => new Array(numClasses).fill(0)),
      classMetrics: [],
    };
  }

  // Confusion matrix: [actual][predicted]
  const matrix: number[][] = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));
  let correct = 0;

  for (let i = 0; i < n; i++) {
    const act = actual[i];
    const pred = predicted[i];
    if (act >= 0 && act < numClasses && pred >= 0 && pred < numClasses) {
      matrix[act][pred]++;
      if (act === pred) correct++;
    }
  }

  const accuracy = Number(((correct / n) * 100).toFixed(2));

  let sumPrec = 0;
  let sumRec = 0;
  let sumF1 = 0;
  let weightedF1Sum = 0;

  const classMetrics: ClassEvaluationMetrics[] = [];

  for (let c = 0; c < numClasses; c++) {
    const tp = matrix[c][c];
    let fp = 0;
    let fn = 0;
    let support = 0;

    for (let row = 0; row < numClasses; row++) {
      if (row !== c) fp += matrix[row][c];
    }
    for (let col = 0; col < numClasses; col++) {
      support += matrix[c][col];
      if (col !== c) fn += matrix[c][col];
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    sumPrec += precision;
    sumRec += recall;
    sumF1 += f1;
    weightedF1Sum += f1 * support;

    classMetrics.push({
      className: classNames[c] || `Class ${c}`,
      precision: Number((precision * 100).toFixed(2)),
      recall: Number((recall * 100).toFixed(2)),
      f1Score: Number((f1 * 100).toFixed(2)),
      support,
    });
  }

  const macroPrecision = Number(((sumPrec / numClasses) * 100).toFixed(2));
  const macroRecall = Number(((sumRec / numClasses) * 100).toFixed(2));
  const macroF1 = Number(((sumF1 / numClasses) * 100).toFixed(2));
  const weightedF1 = Number(((weightedF1Sum / Math.max(1, n)) * 100).toFixed(2));

  return {
    accuracy,
    macroPrecision,
    macroRecall,
    macroF1,
    weightedF1,
    confusionMatrix: matrix,
    classMetrics,
  };
}

// -------------------------------------------------------------
// 4. Statistical Classifiers
// -------------------------------------------------------------

// --- Model 1: Multinomial Logistic Regression (Softmax with L2) ---
export class LogisticRegressionClassifier {
  weights: number[][] = []; // [numClasses][numFeatures]
  biases: number[] = [];
  numClasses: number = 0;
  numFeatures: number = 0;
  lambdaL2: number;
  learningRate: number;
  epochs: number;

  constructor(lambdaL2: number = 0.01, learningRate: number = 0.08, epochs: number = 70) {
    this.lambdaL2 = lambdaL2;
    this.learningRate = learningRate;
    this.epochs = epochs;
  }

  fit(X: number[][], y: number[], numClasses: number) {
    this.numClasses = numClasses;
    const n = X.length;
    if (n === 0) return;
    this.numFeatures = X[0].length;

    // Initialize weights and biases
    this.weights = Array.from({ length: numClasses }, () => new Array(this.numFeatures).fill(0));
    this.biases = new Array(numClasses).fill(0);

    // Mini-batch gradient descent with momentum
    const vW = Array.from({ length: numClasses }, () => new Array(this.numFeatures).fill(0));
    const vB = new Array(numClasses).fill(0);
    const momentum = 0.85;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      for (let i = 0; i < n; i++) {
        const xi = X[i];
        const target = y[i];

        // Softmax probabilities
        const probs = this.predictProbaSingle(xi);

        // Gradients per class
        for (let c = 0; c < numClasses; c++) {
          const error = probs[c] - (c === target ? 1 : 0);
          vB[c] = momentum * vB[c] + this.learningRate * error;
          this.biases[c] -= vB[c];

          for (let f = 0; f < this.numFeatures; f++) {
            const grad = error * xi[f] + this.lambdaL2 * this.weights[c][f];
            vW[c][f] = momentum * vW[c][f] + this.learningRate * grad;
            this.weights[c][f] -= vW[c][f];
          }
        }
      }
    }
  }

  predictProbaSingle(x: number[]): number[] {
    const logits = new Array(this.numClasses).fill(0);
    let maxLogit = -Infinity;

    for (let c = 0; c < this.numClasses; c++) {
      let dot = this.biases[c];
      for (let f = 0; f < this.numFeatures; f++) {
        dot += this.weights[c][f] * x[f];
      }
      logits[c] = dot;
      if (dot > maxLogit) maxLogit = dot;
    }

    // Softmax with numerical stability
    let sumExp = 0;
    const exps = logits.map((l) => {
      const e = Math.exp(l - maxLogit);
      sumExp += e;
      return e;
    });

    return exps.map((e) => e / (sumExp || 1e-9));
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      const probs = this.predictProbaSingle(x);
      let bestClass = 0;
      let maxP = -1;
      probs.forEach((p, idx) => {
        if (p > maxP) {
          maxP = p;
          bestClass = idx;
        }
      });
      return bestClass;
    });
  }
}

// --- Model 2: Random Forest Classifier (Bagging + Feature Subspaces) ---
interface TreeNode {
  isLeaf: boolean;
  predictedClass?: number;
  classDistribution?: number[];
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export class RandomForestClassifier {
  numTrees: number;
  maxDepth: number;
  minSamplesSplit: number;
  trees: TreeNode[] = [];
  featureImportance: number[] = [];
  numClasses: number = 0;
  numFeatures: number = 0;

  constructor(numTrees: number = 20, maxDepth: number = 6, minSamplesSplit: number = 2) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
  }

  fit(X: number[][], y: number[], numClasses: number, seed: number = 101) {
    this.numClasses = numClasses;
    const n = X.length;
    if (n === 0) return;
    this.numFeatures = X[0].length;
    this.featureImportance = new Array(this.numFeatures).fill(0);
    this.trees = [];

    const rng = new SeededRandom(seed);
    const subsetSize = Math.max(2, Math.floor(Math.sqrt(this.numFeatures)));

    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sample with replacement
      const sampleIndices: number[] = [];
      for (let i = 0; i < n; i++) {
        sampleIndices.push(Math.floor(rng.next() * n));
      }

      const tree = this.buildTree(X, y, sampleIndices, 0, subsetSize, rng);
      this.trees.push(tree);
    }

    // Normalize feature importance
    const totalImp = this.featureImportance.reduce((a, b) => a + b, 0) || 1;
    this.featureImportance = this.featureImportance.map((imp) => imp / totalImp);
  }

  private calculateGini(y: number[], indices: number[]): number {
    const total = indices.length;
    if (total === 0) return 0;
    const counts = new Array(this.numClasses).fill(0);
    for (const idx of indices) {
      counts[y[idx]]++;
    }
    let sumSq = 0;
    for (let c = 0; c < this.numClasses; c++) {
      const p = counts[c] / total;
      sumSq += p * p;
    }
    return 1 - sumSq;
  }

  private buildTree(
    X: number[][],
    y: number[],
    indices: number[],
    depth: number,
    subsetSize: number,
    rng: SeededRandom
  ): TreeNode {
    const counts = new Array(this.numClasses).fill(0);
    for (const idx of indices) {
      counts[y[idx]]++;
    }

    let dominantClass = 0;
    let maxCount = -1;
    counts.forEach((cnt, c) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        dominantClass = c;
      }
    });

    const total = indices.length;
    const distribution = counts.map((c) => c / (total || 1));

    // Stop conditions
    if (
      depth >= this.maxDepth ||
      total <= this.minSamplesSplit ||
      maxCount === total
    ) {
      return { isLeaf: true, predictedClass: dominantClass, classDistribution: distribution };
    }

    const currentGini = this.calculateGini(y, indices);

    // Random subset of features
    const allFeats = Array.from({ length: this.numFeatures }, (_, i) => i);
    // Shuffle and pick subsetSize
    for (let i = allFeats.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [allFeats[i], allFeats[j]] = [allFeats[j], allFeats[i]];
    }
    const candidateFeatures = allFeats.slice(0, subsetSize);

    let bestGain = -1;
    let bestFeature = candidateFeatures[0];
    let bestThreshold = 0;
    let bestLeft: number[] = [];
    let bestRight: number[] = [];

    for (const feat of candidateFeatures) {
      // Find candidate thresholds from data values
      const vals = indices.map((idx) => X[idx][feat]).sort((a, b) => a - b);
      // Sample distinct quantiles
      const thresholds = [
        vals[Math.floor(vals.length * 0.25)] || 0,
        vals[Math.floor(vals.length * 0.5)] || 0,
        vals[Math.floor(vals.length * 0.75)] || 0,
      ];

      for (const thresh of thresholds) {
        const left: number[] = [];
        const right: number[] = [];
        for (const idx of indices) {
          if (X[idx][feat] <= thresh) left.push(idx);
          else right.push(idx);
        }
        if (left.length === 0 || right.length === 0) continue;

        const leftGini = this.calculateGini(y, left);
        const rightGini = this.calculateGini(y, right);
        const gain = currentGini - (left.length / total) * leftGini - (right.length / total) * rightGini;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = feat;
          bestThreshold = thresh;
          bestLeft = left;
          bestRight = right;
        }
      }
    }

    if (bestGain <= 0 || bestLeft.length === 0 || bestRight.length === 0) {
      return { isLeaf: true, predictedClass: dominantClass, classDistribution: distribution };
    }

    // Accumulate Gini importance
    this.featureImportance[bestFeature] += bestGain * (total / X.length);

    const leftNode = this.buildTree(X, y, bestLeft, depth + 1, subsetSize, rng);
    const rightNode = this.buildTree(X, y, bestRight, depth + 1, subsetSize, rng);

    return {
      isLeaf: false,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      left: leftNode,
      right: rightNode,
      classDistribution: distribution,
      predictedClass: dominantClass,
    };
  }

  private predictSingle(node: TreeNode, x: number[]): number[] {
    if (node.isLeaf || node.featureIndex === undefined || node.threshold === undefined) {
      return node.classDistribution || new Array(this.numClasses).fill(1 / this.numClasses);
    }
    if (x[node.featureIndex] <= node.threshold) {
      return this.predictSingle(node.left!, x);
    } else {
      return this.predictSingle(node.right!, x);
    }
  }

  predictProbaSingle(x: number[]): number[] {
    const avgProba = new Array(this.numClasses).fill(0);
    for (const tree of this.trees) {
      const p = this.predictSingle(tree, x);
      for (let c = 0; c < this.numClasses; c++) {
        avgProba[c] += (p[c] || 0) / this.trees.length;
      }
    }
    return avgProba;
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      const p = this.predictProbaSingle(x);
      let best = 0;
      let maxP = -1;
      p.forEach((val, idx) => {
        if (val > maxP) {
          maxP = val;
          best = idx;
        }
      });
      return best;
    });
  }
}

// --- Model 3: Multinomial Naive Bayes Classifier (Laplace Smoothed) ---
export class MultinomialNaiveBayesClassifier {
  numClasses: number = 0;
  numFeatures: number = 0;
  classPriors: number[] = [];
  featureLogProbs: number[][] = []; // [numClasses][numFeatures]
  alpha: number;

  constructor(alpha: number = 1.0) {
    this.alpha = alpha;
  }

  fit(X: number[][], y: number[], numClasses: number) {
    this.numClasses = numClasses;
    const n = X.length;
    if (n === 0) return;
    this.numFeatures = X[0].length;

    const classDocCounts = new Array(numClasses).fill(0);
    const classTermTotals = new Array(numClasses).fill(0);
    const termCountsPerClass = Array.from({ length: numClasses }, () => new Array(this.numFeatures).fill(0));

    for (let i = 0; i < n; i++) {
      const c = y[i];
      classDocCounts[c]++;
      for (let f = 0; f < this.numFeatures; f++) {
        const val = X[i][f];
        termCountsPerClass[c][f] += val;
        classTermTotals[c] += val;
      }
    }

    // Priors: P(c) = (N_c + 1) / (N + C)
    this.classPriors = classDocCounts.map((cnt) => Math.log((cnt + 1) / (n + numClasses)));

    // Likelihoods with Laplace smoothing:
    // theta_cf = (sum_x_cf + alpha) / (sum_total_c + alpha * D)
    this.featureLogProbs = Array.from({ length: numClasses }, () => new Array(this.numFeatures).fill(0));
    for (let c = 0; c < numClasses; c++) {
      const denom = classTermTotals[c] + this.alpha * this.numFeatures;
      for (let f = 0; f < this.numFeatures; f++) {
        const num = termCountsPerClass[c][f] + this.alpha;
        this.featureLogProbs[c][f] = Math.log(num / denom);
      }
    }
  }

  predictProbaSingle(x: number[]): number[] {
    const logPosteriors = new Array(this.numClasses).fill(0);
    let maxLogP = -Infinity;

    for (let c = 0; c < this.numClasses; c++) {
      let logP = this.classPriors[c];
      for (let f = 0; f < this.numFeatures; f++) {
        if (x[f] > 0) {
          logP += x[f] * this.featureLogProbs[c][f];
        }
      }
      logPosteriors[c] = logP;
      if (logP > maxLogP) maxLogP = logP;
    }

    let sumExp = 0;
    const exps = logPosteriors.map((lp) => {
      const e = Math.exp(lp - maxLogP);
      sumExp += e;
      return e;
    });

    return exps.map((e) => e / (sumExp || 1e-9));
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      const probs = this.predictProbaSingle(x);
      let best = 0;
      let maxP = -1;
      probs.forEach((p, idx) => {
        if (p > maxP) {
          maxP = p;
          best = idx;
        }
      });
      return best;
    });
  }
}

// --- Model 4: Linear Support Vector Machine (Linear SVM with Pegasos Optimizer) ---
export class LinearSvmClassifier {
  numClasses: number = 0;
  numFeatures: number = 0;
  weights: number[][] = []; // [numClasses][numFeatures]
  biases: number[] = [];
  lambdaReg: number;
  maxIters: number;

  constructor(lambdaReg: number = 0.005, maxIters: number = 1000) {
    this.lambdaReg = lambdaReg;
    this.maxIters = maxIters;
  }

  fit(X: number[][], y: number[], numClasses: number) {
    this.numClasses = numClasses;
    const n = X.length;
    if (n === 0) return;
    this.numFeatures = X[0].length;

    this.weights = Array.from({ length: numClasses }, () => new Array(this.numFeatures).fill(0));
    this.biases = new Array(numClasses).fill(0);

    // Train One-vs-Rest linear SVM for each class using Pegasos sub-gradient descent
    for (let c = 0; c < numClasses; c++) {
      const w = this.weights[c];
      let b = 0;

      for (let t = 1; t <= this.maxIters; t++) {
        const i = (t - 1) % n;
        const target = y[i] === c ? 1 : -1;
        const eta = 1 / (this.lambdaReg * t + 1);

        let dot = b;
        for (let f = 0; f < this.numFeatures; f++) {
          dot += w[f] * X[i][f];
        }

        // Hinge loss condition: target * (w . x + b) < 1
        if (target * dot < 1) {
          for (let f = 0; f < this.numFeatures; f++) {
            w[f] = (1 - eta * this.lambdaReg) * w[f] + eta * target * X[i][f];
          }
          b += eta * target * 0.1;
        } else {
          for (let f = 0; f < this.numFeatures; f++) {
            w[f] = (1 - eta * this.lambdaReg) * w[f];
          }
        }
      }

      this.biases[c] = b;
    }
  }

  predictProbaSingle(x: number[]): number[] {
    const scores = new Array(this.numClasses).fill(0);
    let maxScore = -Infinity;

    for (let c = 0; c < this.numClasses; c++) {
      let margin = this.biases[c];
      for (let f = 0; f < this.numFeatures; f++) {
        margin += this.weights[c][f] * x[f];
      }
      scores[c] = margin;
      if (margin > maxScore) maxScore = margin;
    }

    // Platt/Softmax approximation for multi-class SVM margins
    let sumExp = 0;
    const exps = scores.map((s) => {
      const e = Math.exp(Math.min(20, Math.max(-20, s - maxScore)));
      sumExp += e;
      return e;
    });

    return exps.map((e) => e / (sumExp || 1e-9));
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      const p = this.predictProbaSingle(x);
      let best = 0;
      let maxP = -1;
      p.forEach((val, idx) => {
        if (val > maxP) {
          maxP = val;
          best = idx;
        }
      });
      return best;
    });
  }
}

// -------------------------------------------------------------
// 5. Target Label Generator & Period Segmenter
// -------------------------------------------------------------
export function assignDocumentTargetLabels(
  docs: BibliometricDocument[],
  targetType: "temporal_period" | "research_theme" | "impact_velocity" = "temporal_period"
): {
  labels: number[];
  classNames: string[];
  targetDescription: string;
} {
  const n = docs.length;
  if (n === 0) {
    return {
      labels: [],
      classNames: ["Class 1", "Class 2"],
      targetDescription: "Empty Document Set",
    };
  }

  if (targetType === "temporal_period") {
    // Collect valid years (supporting both year and PY)
    const years = docs.map((d) => {
      const y = Number(d.year || (d as any).PY || 0);
      return y > 1900 ? y : 2023;
    });
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    if (maxYear - minYear >= 2) {
      // Create 3 distinct historical periods
      const span = maxYear - minYear;
      const cut1 = minYear + Math.floor(span / 3);
      const cut2 = minYear + Math.floor((2 * span) / 3);

      const p1Label = `Early Era (${minYear}-${cut1})`;
      const p2Label = `Consolidation (${cut1 + 1}-${cut2})`;
      const p3Label = `Frontier (${cut2 + 1}-${maxYear})`;

      const labels = years.map((y) => (y <= cut1 ? 0 : y <= cut2 ? 1 : 2));
      return {
        labels,
        classNames: [p1Label, p2Label, p3Label],
        targetDescription: `Temporal Publication Eras (${minYear} - ${maxYear})`,
      };
    } else {
      // 2 periods by median
      const sortedYears = [...years].sort((a, b) => a - b);
      const medianYear = sortedYears[Math.floor(sortedYears.length / 2)] || 2023;
      const labels = years.map((y) => (y <= medianYear ? 0 : 1));
      return {
        labels,
        classNames: [`Emerging Period (<= ${medianYear})`, `Modern Period (> ${medianYear})`],
        targetDescription: `Chronological Temporal Split around year ${medianYear}`,
      };
    }
  }

  if (targetType === "impact_velocity") {
    const citations = docs.map((d) => Math.max(0, Number(d.citations ?? (d as any).TC ?? 0)));
    const sortedCitations = [...citations].sort((a, b) => a - b);
    const p33 = sortedCitations[Math.floor(sortedCitations.length * 0.33)] || 10;
    const p66 = sortedCitations[Math.floor(sortedCitations.length * 0.66)] || 40;

    const labels = citations.map((c) => (c < p33 ? 0 : c < p66 ? 1 : 2));
    return {
      labels,
      classNames: [
        `Baseline Velocity (< ${p33} cites)`,
        `Moderate Growth (${p33}-${p66} cites)`,
        `Breakthrough Impact (>= ${p66} cites)`,
      ],
      targetDescription: "Citation Impact Acceleration Velocity Tiers",
    };
  }


  // Fallback: Research Theme / Discipline clustering
  const categories = docs.map((d) => {
    const sc = (d as any).research_areas || (d as any).SC || [];
    if (Array.isArray(sc) && sc.length > 0) return sc[0];
    const kw = d.keywords || (d as any).DE || [];
    if (Array.isArray(kw) && kw.length > 0) return kw[0];
    return "Interdisciplinary";
  });


  // Count top 3 categories
  const catCounts = new Map<string, number>();
  categories.forEach((c) => catCounts.set(c, (catCounts.get(c) || 0) + 1));
  const topCats = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  if (topCats.length < 2) {
    topCats.push("Other Discipline");
  }

  const labels = categories.map((c) => {
    const idx = topCats.indexOf(c);
    return idx !== -1 ? idx : topCats.length - 1;
  });

  return {
    labels,
    classNames: topCats,
    targetDescription: "Disciplinary Domain & Research Focus Themes",
  };
}

// -------------------------------------------------------------
// 6. Master Statistical Classification & Stratified CV Runner
// -------------------------------------------------------------
export interface RunClassificationOptions {
  targetType?: "temporal_period" | "research_theme" | "impact_velocity";
  kFolds?: number;
  maxFeatures?: number;
  includeBigrams?: boolean;
}

export function executeStatisticalTextClassification(
  docs: BibliometricDocument[],
  options: RunClassificationOptions = {}
): TextClassificationOutput {
  const targetType = options.targetType || "temporal_period";
  const requestedKFolds = options.kFolds || 5;
  const maxFeatures = options.maxFeatures || 160;
  const includeBigrams = options.includeBigrams ?? true;

  // 1. Assign Targets
  const { labels, classNames, targetDescription } = assignDocumentTargetLabels(docs, targetType);
  const numClasses = classNames.length;
  const totalDocs = docs.length;

  // 2. Adjust K-Folds to fit min class support
  const classCounts = new Array(numClasses).fill(0);
  labels.forEach((l) => classCounts[l]++);
  const minClassCount = Math.min(...classCounts);
  const effectiveKFolds = Math.max(2, Math.min(requestedKFolds, minClassCount));

  // 3. Extract Token Sequences and Build Global TF-IDF Matrix
  const docTokens = docs.map((d) => {
    const title = d.title || (d as any).TI || "";
    const kw = Array.isArray(d.keywords) ? d.keywords : (Array.isArray((d as any).DE) ? (d as any).DE : []);
    const idKw = Array.isArray((d as any).ID) ? (d as any).ID : [];
    const abstract = d.abstract || (d as any).AB || "";
    const text = `${title} ${kw.join(" ")} ${idKw.join(" ")} ${abstract}`;
    return extractCleanTokens(text, includeBigrams);
  });


  const vectorizer = new TextTfidfEngine();
  const X = vectorizer.fitTransform(docTokens, maxFeatures, 1);
  const vocab = vectorizer.reverseVocab;

  // 4. Generate Stratified K-Fold Splits
  const folds = generateStratifiedKFolds(labels, effectiveKFolds, 42);

  // 5. Train & Evaluate Models across Stratified Folds
  const modelTypes: StatisticalClassifierType[] = [
    "logistic_regression",
    "random_forest",
    "naive_bayes",
    "linear_svm",
  ];

  const modelMeta: Record<
    StatisticalClassifierType,
    { name: string; family: string; summary: string }
  > = {
    logistic_regression: {
      name: "Multinomial Logistic Regression",
      family: "Generalized Linear Models (GLM)",
      summary: "Softmax Cross-Entropy with L2 regularization & gradient descent optimization.",
    },
    random_forest: {
      name: "Random Forest Classifier",
      family: "Ensemble Tree Methods (Bagging)",
      summary: "Bootstrap bagging with feature subspace sampling (sqrt(D)) & Gini impurity minimization.",
    },
    naive_bayes: {
      name: "Multinomial Naive Bayes",
      family: "Bayesian Generative Models",
      summary: "Laplace smoothed multinomial likelihoods with log-posterior decision rules.",
    },
    linear_svm: {
      name: "Linear Support Vector Machine",
      family: "Max-Margin Hyperplane (Pegasos)",
      summary: "Soft-margin hinge loss optimization with Pegasos subgradient descent and Platt calibration.",
    },
  };

  const benchmarks = {} as Record<StatisticalClassifierType, ModelBenchmarkResult>;

  // Global instances to fit full dataset for overall feature rankings and inference
  const globalModels = {
    logistic_regression: new LogisticRegressionClassifier(0.01, 0.08, 60),
    random_forest: new RandomForestClassifier(20, 6, 2),
    naive_bayes: new MultinomialNaiveBayesClassifier(1.0),
    linear_svm: new LinearSvmClassifier(0.005, 800),
  };

  modelTypes.forEach((mType) => {
    const foldResults: FoldEvaluationResult[] = [];
    let startTrainTime = Date.now();

    // Cross-validation loop
    folds.forEach((fold, fIdx) => {
      const XTrain = fold.trainIndices.map((i) => X[i]);
      const yTrain = fold.trainIndices.map((i) => labels[i]);
      const XVal = fold.valIndices.map((i) => X[i]);
      const yVal = fold.valIndices.map((i) => labels[i]);

      let model: any;
      if (mType === "logistic_regression") {
        model = new LogisticRegressionClassifier(0.01, 0.08, 50);
      } else if (mType === "random_forest") {
        model = new RandomForestClassifier(15, 6, 2);
      } else if (mType === "naive_bayes") {
        model = new MultinomialNaiveBayesClassifier(1.0);
      } else {
        model = new LinearSvmClassifier(0.005, 600);
      }

      model.fit(XTrain, yTrain, numClasses);
      const valPreds = model.predict(XVal);

      const metrics = computeClassificationMetrics(yVal, valPreds, numClasses, classNames);

      foldResults.push({
        foldIndex: fIdx + 1,
        trainCount: XTrain.length,
        valCount: XVal.length,
        accuracy: metrics.accuracy,
        macroPrecision: metrics.macroPrecision,
        macroRecall: metrics.macroRecall,
        macroF1: metrics.macroF1,
        confusionMatrix: metrics.confusionMatrix,
        classLabels: classNames,
      });
    });

    const elapsed = Date.now() - startTrainTime;

    // Aggregate Mean and Std across folds
    const meanAcc = Number(
      (foldResults.reduce((sum, f) => sum + f.accuracy, 0) / effectiveKFolds).toFixed(2)
    );
    const stdAcc = Number(
      Math.sqrt(
        foldResults.reduce((sum, f) => sum + Math.pow(f.accuracy - meanAcc, 2), 0) / effectiveKFolds
      ).toFixed(2)
    );

    const meanF1 = Number(
      (foldResults.reduce((sum, f) => sum + f.macroF1, 0) / effectiveKFolds).toFixed(2)
    );
    const stdF1 = Number(
      Math.sqrt(
        foldResults.reduce((sum, f) => sum + Math.pow(f.macroF1 - meanF1, 2), 0) / effectiveKFolds
      ).toFixed(2)
    );

    const meanPrec = Number(
      (foldResults.reduce((sum, f) => sum + f.macroPrecision, 0) / effectiveKFolds).toFixed(2)
    );
    const meanRec = Number(
      (foldResults.reduce((sum, f) => sum + f.macroRecall, 0) / effectiveKFolds).toFixed(2)
    );

    // Sum overall confusion matrix across folds
    const overallMatrix: number[][] = Array.from({ length: numClasses }, () =>
      new Array(numClasses).fill(0)
    );
    foldResults.forEach((f) => {
      for (let r = 0; r < numClasses; r++) {
        for (let c = 0; c < numClasses; c++) {
          overallMatrix[r][c] += f.confusionMatrix[r][c];
        }
      }
    });

    // Train on full dataset
    globalModels[mType].fit(X, labels, numClasses);
    const fullPreds = globalModels[mType].predict(X);
    const fullMetrics = computeClassificationMetrics(labels, fullPreds, numClasses, classNames);

    benchmarks[mType] = {
      modelType: mType,
      displayName: modelMeta[mType].name,
      family: modelMeta[mType].family,
      algorithmSummary: modelMeta[mType].summary,
      meanAccuracy: meanAcc,
      stdAccuracy: stdAcc,
      meanMacroF1: meanF1,
      stdMacroF1: stdF1,
      meanWeightedF1: fullMetrics.weightedF1,
      meanPrecision: meanPrec,
      meanRecall: meanRec,
      trainingTimeMs: elapsed,
      folds: foldResults,
      overallConfusionMatrix: overallMatrix,
      classMetrics: fullMetrics.classMetrics,
    };
  });

  // 6. Find Best Model by Mean Macro F1 / Accuracy
  let bestModel: StatisticalClassifierType = "logistic_regression";
  let maxScore = -1;
  modelTypes.forEach((m) => {
    const score = benchmarks[m].meanMacroF1 * 0.7 + benchmarks[m].meanAccuracy * 0.3;
    if (score > maxScore) {
      maxScore = score;
      bestModel = m;
    }
  });

  // 7. Compute Distinctive Feature Ranking per Class (Distinctive features per era or cohort [761])
  const lrWeights = globalModels.logistic_regression.weights;
  const rfImp = globalModels.random_forest.featureImportance;
  const nbProbs = globalModels.naive_bayes.featureLogProbs;
  const svmWeights = globalModels.linear_svm.weights;

  const distinctiveFeaturesByClass: Record<string, DistinctiveFeature[]> = {};
  const allFeaturesList: DistinctiveFeature[] = [];

  classNames.forEach((cName, cIdx) => {
    const classFeatures: DistinctiveFeature[] = [];

    // Identify docs in vs out of class
    const inClassDocs = docs.filter((_, idx) => labels[idx] === cIdx);
    const outClassDocs = docs.filter((_, idx) => labels[idx] !== cIdx);
    const nIn = Math.max(1, inClassDocs.length);
    const nOut = Math.max(1, outClassDocs.length);

    vocab.forEach((term, fIdx) => {
      // Calculate empirical occurrence counts
      const inCount = inClassDocs.filter((d) => {
        const fullText = `${d.title || ""} ${(d.keywords || []).join(" ")} ${d.abstract || ""}`.toLowerCase();
        return fullText.includes(term.replace("_", " "));
      }).length;

      const outCount = outClassDocs.filter((d) => {
        const fullText = `${d.title || ""} ${(d.keywords || []).join(" ")} ${d.abstract || ""}`.toLowerCase();
        return fullText.includes(term.replace("_", " "));
      }).length;

      const inPct = (inCount / nIn) * 100;
      const outPct = (outCount / nOut) * 100;

      // Odds Ratio
      const pIn = (inCount + 0.5) / (nIn + 1);
      const pOut = (outCount + 0.5) / (nOut + 1);
      const oddsRatio = Number((((pIn / (1 - pIn))) / ((pOut / (1 - pOut)))).toFixed(2));

      // Model signals
      const lrW = lrWeights[cIdx] ? lrWeights[cIdx][fIdx] || 0 : 0;
      const rfVal = rfImp[fIdx] || 0;
      const nbLLR = nbProbs[cIdx] ? nbProbs[cIdx][fIdx] - (nbProbs[(cIdx + 1) % numClasses]?.[fIdx] || -10) : 0;
      const svmW = svmWeights[cIdx] ? svmWeights[cIdx][fIdx] || 0 : 0;

      // Sample paper titles featuring this term
      const sampleTitles = inClassDocs
        .filter((d) => (d.title || "").toLowerCase().includes(term.replace("_", " ")))
        .map((d) => d.title || "Untitled Document")
        .slice(0, 2);

      // Composite score combining all 4 classifiers and Odds Ratio
      const rawComposite =
        Math.max(0, lrW) * 25 +
        rfVal * 500 +
        Math.max(0, nbLLR) * 12 +
        Math.max(0, svmW) * 20 +
        Math.min(50, oddsRatio * 5);

      classFeatures.push({
        feature: term.replace("_", " "),
        compositeScore: Number(rawComposite.toFixed(1)),
        targetClass: cName,
        oddsRatio,
        inClassRatioPct: Number(inPct.toFixed(1)),
        outClassRatioPct: Number(outPct.toFixed(1)),
        logisticWeight: Number(lrW.toFixed(3)),
        randomForestImportance: Number((rfVal * 100).toFixed(2)),
        naiveBayesLLR: Number(nbLLR.toFixed(2)),
        svmWeight: Number(svmW.toFixed(3)),
        sampleTitles,
      });
    });

    // Sort by composite score
    classFeatures.sort((a, b) => b.compositeScore - a.compositeScore);

    // Normalize top scores to 0-100 scale
    const topScore = classFeatures[0]?.compositeScore || 1;
    const scaledFeatures = classFeatures.slice(0, 30).map((f) => ({
      ...f,
      compositeScore: Number(((f.compositeScore / topScore) * 100).toFixed(1)),
    }));

    distinctiveFeaturesByClass[cName] = scaledFeatures;
    allFeaturesList.push(...scaledFeatures);
  });

  // Sort overall features
  allFeaturesList.sort((a, b) => b.compositeScore - a.compositeScore);

  // 8. Sample document predictions across all 4 models
  const sampleEvaluations = docs.slice(0, 20).map((doc, idx) => {
    const xVec = X[idx];
    const act = classNames[labels[idx]];

    const lrProb = globalModels.logistic_regression.predictProbaSingle(xVec);
    const rfProb = globalModels.random_forest.predictProbaSingle(xVec);
    const nbProb = globalModels.naive_bayes.predictProbaSingle(xVec);
    const svmProb = globalModels.linear_svm.predictProbaSingle(xVec);

    const getBest = (pArr: number[]) => {
      let b = 0;
      let maxVal = -1;
      pArr.forEach((v, i) => {
        if (v > maxVal) {
          maxVal = v;
          b = i;
        }
      });
      return { className: classNames[b], conf: Number((maxVal * 100).toFixed(1)) };
    };

    const predLR = getBest(lrProb);
    const predRF = getBest(rfProb);
    const predNB = getBest(nbProb);
    const predSVM = getBest(svmProb);

    return {
      id: doc.id || `doc-${idx + 1}`,
      title: doc.title || (doc as any).TI || "Untitled Document",
      actualClass: act,
      predictedByModel: {
        logistic_regression: predLR.className,
        random_forest: predRF.className,
        naive_bayes: predNB.className,
        linear_svm: predSVM.className,
      },
      confidenceByModel: {
        logistic_regression: predLR.conf,
        random_forest: predRF.conf,
        naive_bayes: predNB.conf,
        linear_svm: predSVM.conf,
      },
    };
  });

  return {
    targetType,
    targetDescription,
    classes: classNames,
    kFolds: effectiveKFolds,
    vocabularySize: vocab.length,
    totalDocuments: totalDocs,
    benchmarks,
    bestModel,
    distinctiveFeaturesByClass,
    allRankedFeatures: allFeaturesList.slice(0, 60),
    sampleEvaluations,
  };
}
