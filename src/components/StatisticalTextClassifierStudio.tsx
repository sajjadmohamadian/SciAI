import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Sliders,
  Sparkles,
  BarChart2,
  TrendingUp,
  Cpu,
  Target,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Award,
  ChevronRight,
  Download,
  Filter,
  FileText,
  HelpCircle,
  Zap,
} from "lucide-react";
import {
  Dataset,
  TextClassificationOutput,
  StatisticalClassifierType,
  DistinctiveFeature,
  ModelBenchmarkResult,
} from "../types.js";

interface Props {
  dataset?: Dataset;
}

export function StatisticalTextClassifierStudio({ dataset }: Props) {
  // Hyperparameters & Configuration
  const [targetType, setTargetType] = useState<"temporal_period" | "research_theme" | "impact_velocity">("temporal_period");
  const [kFolds, setKFolds] = useState<number>(5);
  const [maxFeatures, setMaxFeatures] = useState<number>(160);
  const [includeBigrams, setIncludeBigrams] = useState<boolean>(true);

  // Training & State
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [results, setResults] = useState<TextClassificationOutput | null>(null);

  // Active View selections inside this studio
  const [selectedModelTab, setSelectedModelTab] = useState<StatisticalClassifierType>("logistic_regression");
  const [activeEraFilter, setActiveEraFilter] = useState<string>("all");
  const [featureSearchQuery, setFeatureSearchQuery] = useState<string>("");

  // Live Interactive Inference Playground
  const [testTitle, setTestTitle] = useState<string>(
    "Foundation Transformers and Self-Supervised Topological Embeddings for Biological Networks"
  );
  const [testAbstract, setTestAbstract] = useState<string>(
    "We present a novel self-supervised foundation transformer model trained on large-scale topological biological network graphs and single-cell RNA transcriptomic datasets. Our empirical results demonstrate breakthrough predictive performance across multi-modal gene regulatory benchmarks."
  );
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictResult, setPredictResult] = useState<any>(null);

  // Train models on mount or when dataset changes
  const runTraining = async () => {
    setIsTraining(true);
    setTrainError(null);
    try {
      const res = await fetch("/api/ml/text-classification/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: dataset?.id,
          target_type: targetType,
          k_folds: kFolds,
          max_features: maxFeatures,
          include_bigrams: includeBigrams,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.result) {
        setResults(data.result);
        setSelectedModelTab(data.result.bestModel || "logistic_regression");
      } else {
        throw new Error("Invalid response format from classifier backend");
      }
    } catch (err: any) {
      console.error("Text classification error:", err);
      setTrainError(err?.message || "Failed to train statistical classifiers");
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    runTraining();
  }, [targetType, kFolds, maxFeatures, includeBigrams, dataset?.id]);

  // Handle live prediction
  const handleLivePredict = async () => {
    if (!testTitle.trim() && !testAbstract.trim()) return;
    setIsPredicting(true);
    try {
      const res = await fetch("/api/ml/text-classification/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: dataset?.id,
          target_type: targetType,
          title: testTitle,
          abstract: testAbstract,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPredictResult(data);
      }
    } catch (err) {
      console.error("Prediction failed:", err);
    } finally {
      setIsPredicting(false);
    }
  };

  // Export ranked features to CSV
  const handleExportCSV = () => {
    if (!results || !results.allRankedFeatures) return;
    const headers = [
      "Feature",
      "Target_Class",
      "Composite_Score",
      "Odds_Ratio",
      "In_Class_Pct",
      "Out_Class_Pct",
      "Logistic_Weight",
      "Random_Forest_Importance",
      "Naive_Bayes_LLR",
      "SVM_Weight",
    ];
    const rows = results.allRankedFeatures.map((f) => [
      `"${f.feature}"`,
      `"${f.targetClass}"`,
      f.compositeScore,
      f.oddsRatio,
      f.inClassRatioPct,
      f.outClassRatioPct,
      f.logisticWeight,
      f.randomForestImportance,
      f.naiveBayesLLR,
      f.svmWeight,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `distinctive_features_${targetType}_761.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter distinctive features based on selected era and search query
  const displayedFeatures = (
    activeEraFilter === "all"
      ? results?.allRankedFeatures || []
      : results?.distinctiveFeaturesByClass[activeEraFilter] || []
  ).filter((f) =>
    featureSearchQuery
      ? f.feature.toLowerCase().includes(featureSearchQuery.toLowerCase()) ||
        f.targetClass.toLowerCase().includes(featureSearchQuery.toLowerCase())
      : true
  );

  const modelOrder: StatisticalClassifierType[] = [
    "logistic_regression",
    "random_forest",
    "naive_bayes",
    "linear_svm",
  ];

  const currentBenchmark: ModelBenchmarkResult | undefined =
    results?.benchmarks?.[selectedModelTab];

  return (
    <div className="space-y-6" id="statistical-text-classifier-studio">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50/80 via-purple-50/40 to-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  Statistical Text Classification & Stratified K-Fold CV
                </h3>
                <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-black text-indigo-800 tracking-wider">
                  Milestone [761]
                </span>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                  TF-IDF + N-Grams
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  Stratified K-Fold
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 max-w-4xl leading-relaxed">
                Stratified k-fold cross-validation of <strong>Multinomial Logistic Regression</strong>, <strong>Random Forest</strong>, <strong>Multinomial Naive Bayes</strong>, and <strong>Linear SVM</strong> classifiers over TF-IDF bibliometric n-gram vectors. Enables rigorous multi-class prediction and comprehensive ranking of distinctive features characterizing temporal eras, research themes, or citation velocity cohorts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={runTraining}
              disabled={isTraining}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isTraining ? "animate-spin" : ""}`} />
              {isTraining ? "Training & Evaluating..." : "Retrain Classifiers"}
            </button>
          </div>
        </div>

        {/* Hyperparameter Controls Bar */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-indigo-100/80 pt-5 text-xs">
          {/* Target Grouping */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
              Target Classification Variable
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="temporal_period">Temporal Publication Eras</option>
              <option value="research_theme">Disciplinary Research Themes</option>
              <option value="impact_velocity">Citation Impact Acceleration Tiers</option>
            </select>
          </div>

          {/* Stratified K-Folds */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Stratified K-Folds</span>
              <span className="font-black text-indigo-600">{kFolds}-Fold</span>
            </label>
            <select
              value={kFolds}
              onChange={(e) => setKFolds(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value={3}>3-Fold Stratified Cross-Validation</option>
              <option value={4}>4-Fold Stratified Cross-Validation</option>
              <option value={5}>5-Fold Stratified Cross-Validation (Standard)</option>
              <option value={8}>8-Fold Stratified Cross-Validation</option>
              <option value={10}>10-Fold Stratified Cross-Validation</option>
            </select>
          </div>

          {/* Max TF-IDF Features */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Feature Dimension (TF-IDF Vocabulary)</span>
              <span className="font-black text-indigo-600">{maxFeatures} Terms</span>
            </label>
            <select
              value={maxFeatures}
              onChange={(e) => setMaxFeatures(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value={80}>80 Top Salient Features (Fast)</option>
              <option value={120}>120 Top Salient Features</option>
              <option value={160}>160 Top Salient Features (Recommended)</option>
              <option value={220}>220 Top Salient Features (Dense)</option>
            </select>
          </div>

          {/* N-Gram Configuration */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
              N-Gram Tokenization Range
            </label>
            <div className="flex items-center h-9 gap-2">
              <button
                type="button"
                onClick={() => setIncludeBigrams(!includeBigrams)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                  includeBigrams
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${includeBigrams ? "bg-indigo-600" : "bg-slate-300"}`} />
                <span>{includeBigrams ? "Unigrams + Bigrams (1,2)" : "Unigrams Only (1,1)"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {trainError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <strong>Classifier Training Error:</strong> {trainError}
          </div>
        </div>
      )}

      {/* 2. Key High-Level Scientometric Metrics Cards */}
      {results && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              Best Performing Model
            </div>
            <div className="mt-1.5 text-base font-black text-slate-900 truncate">
              {results.benchmarks[results.bestModel]?.displayName || "Logistic Regression"}
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 font-bold">
              Optimal F1-Score & Accuracy Trade-off
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
              Mean Accuracy
            </div>
            <div className="mt-1.5 text-2xl font-black text-slate-900">
              {results.benchmarks[results.bestModel]?.meanAccuracy}%
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-medium">
              ±{results.benchmarks[results.bestModel]?.stdAccuracy}% cross-fold std.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-purple-500" />
              Macro F1-Score
            </div>
            <div className="mt-1.5 text-2xl font-black text-slate-900">
              {results.benchmarks[results.bestModel]?.meanMacroF1}%
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-medium">
              Weighted F1: {results.benchmarks[results.bestModel]?.meanWeightedF1}%
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-500" />
              Vocabulary Size
            </div>
            <div className="mt-1.5 text-2xl font-black text-slate-900">
              {results.vocabularySize}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-medium">
              Extracted from {results.totalDocuments} corpus documents
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs col-span-2 md:col-span-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              Target Classes / Cohorts
            </div>
            <div className="mt-1.5 text-2xl font-black text-slate-900">
              {results.classes.length} Classes
            </div>
            <div className="mt-1 text-[11px] text-slate-500 font-medium truncate">
              {results.classes.join(" • ")}
            </div>
          </div>
        </div>
      )}

      {/* 3. The 4 Statistical Classifiers Comparative Benchmark Grid */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-indigo-600" />
              Comparative Benchmark of 4 Statistical Text Classifiers
            </h4>
            <span className="text-xs text-slate-500">
              Evaluated via {results.kFolds}-Fold Stratified Cross-Validation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {modelOrder.map((mKey) => {
              const bm = results.benchmarks[mKey];
              if (!bm) return null;
              const isBest = results.bestModel === mKey;
              const isSelected = selectedModelTab === mKey;

              return (
                <div
                  key={mKey}
                  onClick={() => setSelectedModelTab(mKey)}
                  className={`rounded-2xl border p-5 transition-all cursor-pointer relative ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/30 shadow-md ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                  }`}
                >
                  {isBest && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-black">
                      <Award className="h-3 w-3 text-amber-600" />
                      Best F1
                    </div>
                  )}

                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {bm.family}
                  </div>
                  <h5 className="mt-1 text-sm font-black text-slate-900">
                    {bm.displayName}
                  </h5>
                  <p className="mt-1 text-[11px] text-slate-500 leading-normal line-clamp-2">
                    {bm.algorithmSummary}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400">Mean Accuracy</div>
                      <div className="text-base font-black text-slate-900">
                        {bm.meanAccuracy}%
                      </div>
                      <div className="text-[10px] text-slate-400">±{bm.stdAccuracy}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400">Macro F1 Score</div>
                      <div className="text-base font-black text-indigo-700">
                        {bm.meanMacroF1}%
                      </div>
                      <div className="text-[10px] text-slate-400">±{bm.stdMacroF1}%</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/70 rounded-xl p-2.5">
                    <div>
                      <span className="text-slate-400">Precision:</span>{" "}
                      <span className="font-bold text-slate-800">{bm.meanPrecision}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Recall:</span>{" "}
                      <span className="font-bold text-slate-800">{bm.meanRecall}%</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <Clock className="h-3 w-3" />
                      <span>Total Training Time: {bm.trainingTimeMs} ms</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-indigo-600">
                    <span>View fold breakdown & confusion matrix</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Deep Dive Inspection of Selected Model: Folds Breakdown & Confusion Matrix */}
      {currentBenchmark && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 uppercase">
                  {currentBenchmark.family}
                </span>
                <h4 className="text-base font-black text-slate-900">
                  Diagnostic Model Evaluation: {currentBenchmark.displayName}
                </h4>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {currentBenchmark.algorithmSummary}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Select Model:</span>
              <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50 text-xs">
                {modelOrder.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedModelTab(m)}
                    className={`rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                      selectedModelTab === m
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {m === "logistic_regression"
                      ? "Logistic"
                      : m === "random_forest"
                      ? "Random Forest"
                      : m === "naive_bayes"
                      ? "Naive Bayes"
                      : "Linear SVM"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Fold-by-Fold Cross-Validation Metrics Table */}
            <div>
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                Per-Fold Stratified Cross-Validation Breakdown ({currentBenchmark.folds.length} Folds)
              </h5>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Fold #</th>
                      <th className="px-3 py-2.5">Train / Val</th>
                      <th className="px-3 py-2.5 text-right">Accuracy</th>
                      <th className="px-3 py-2.5 text-right">Precision</th>
                      <th className="px-3 py-2.5 text-right">Recall</th>
                      <th className="px-3 py-2.5 text-right">Macro F1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {currentBenchmark.folds.map((f) => (
                      <tr key={f.foldIndex} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-bold text-slate-900">Fold {f.foldIndex}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {f.trainCount} / {f.valCount} docs
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">
                          {f.accuracy}%
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{f.macroPrecision}%</td>
                        <td className="px-3 py-2 text-right text-slate-600">{f.macroRecall}%</td>
                        <td className="px-3 py-2 text-right font-black text-indigo-600">
                          {f.macroF1}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 font-black text-slate-900 border-t-2 border-slate-200">
                      <td className="px-3 py-2.5">Mean ± Std</td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {results?.totalDocuments} docs
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {currentBenchmark.meanAccuracy}% ±{currentBenchmark.stdAccuracy}%
                      </td>
                      <td className="px-3 py-2.5 text-right">{currentBenchmark.meanPrecision}%</td>
                      <td className="px-3 py-2.5 text-right">{currentBenchmark.meanRecall}%</td>
                      <td className="px-3 py-2.5 text-right text-indigo-700">
                        {currentBenchmark.meanMacroF1}% ±{currentBenchmark.stdMacroF1}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Confusion Matrix Heatmap & Per-Class Breakdown */}
            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                Overall Confusion Matrix (Actual vs. Predicted)
              </h5>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr>
                        <th className="p-2 text-left font-bold text-slate-400 text-[10px]">
                          Actual ↓ \ Predicted →
                        </th>
                        {results?.classes.map((cName, idx) => (
                          <th key={idx} className="p-2 font-extrabold text-slate-700 truncate max-w-[120px]">
                            {cName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentBenchmark.overallConfusionMatrix.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="p-2 text-left font-extrabold text-slate-700 truncate max-w-[140px]">
                            {results?.classes[rIdx]}
                          </td>
                          {row.map((val, cIdx) => {
                            const isDiagonal = rIdx === cIdx;
                            return (
                              <td key={cIdx} className="p-2">
                                <div
                                  className={`rounded-lg py-2 px-3 font-black text-xs transition-colors ${
                                    isDiagonal
                                      ? val > 0
                                        ? "bg-emerald-600 text-white shadow-2xs"
                                        : "bg-emerald-100 text-emerald-800"
                                      : val > 0
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-white text-slate-400 border border-slate-100"
                                  }`}
                                >
                                  {val}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-Class Precision, Recall, F1 */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Target Class / Cohort</th>
                      <th className="px-3 py-2 text-right">Precision</th>
                      <th className="px-3 py-2 text-right">Recall</th>
                      <th className="px-3 py-2 text-right">F1-Score</th>
                      <th className="px-3 py-2 text-right">Support</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentBenchmark.classMetrics.map((cm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-1.5 font-bold text-slate-800">{cm.className}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-slate-700">{cm.precision}%</td>
                        <td className="px-3 py-1.5 text-right font-medium text-slate-700">{cm.recall}%</td>
                        <td className="px-3 py-1.5 text-right font-black text-indigo-600">{cm.f1Score}%</td>
                        <td className="px-3 py-1.5 text-right text-slate-500 font-medium">{cm.support} docs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Distinctive Features Ranking per Era or Cohort [761] */}
      {results && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-slate-900">
                  Distinctive Feature Ranking per Era or Cohort [761]
                </h4>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                  Distinctive Feature Ranking
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Identification and multi-metric ranking of salient n-grams synthesizing Multinomial Logistic Regression weights, Random Forest Gini impurity reduction, Naive Bayes log-likelihood ratios, Linear SVM hyperplane normal vectors, and Odds Ratios.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Export Ranked Features (CSV)
            </button>
          </div>

          {/* Era Filter Tabs & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Era Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveEraFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  activeEraFilter === "all"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Features ({results.allRankedFeatures.length})
              </button>
              {results.classes.map((cName) => {
                const count = results.distinctiveFeaturesByClass[cName]?.length || 0;
                return (
                  <button
                    key={cName}
                    onClick={() => setActiveEraFilter(cName)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      activeEraFilter === cName
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
                    }`}
                  >
                    {cName} ({count})
                  </button>
                );
              })}
            </div>

            {/* Keyword Search Filter */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search feature or target class..."
                value={featureSearchQuery}
                onChange={(e) => setFeatureSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Features Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Distinctive Feature (N-Gram)</th>
                  <th className="px-4 py-3">Target Cohort</th>
                  <th className="px-4 py-3 text-center">Composite Salience Score</th>
                  <th className="px-4 py-3 text-right">Odds Ratio</th>
                  <th className="px-4 py-3 text-right">In-Cohort vs. Out-Cohort Pct</th>
                  <th className="px-4 py-3 text-center">Model Signals (LR / RF / NB / SVM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayedFeatures.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No features matched the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  displayedFeatures.map((feat, idx) => (
                    <tr key={`${feat.feature}-${feat.targetClass}`} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Term & Sample Titles */}
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900 text-xs">
                          {feat.feature}
                        </div>
                        {feat.sampleTitles && feat.sampleTitles.length > 0 && (
                          <div className="mt-1 text-[10px] text-slate-500 italic max-w-sm truncate" title={feat.sampleTitles.join(" | ")}>
                            Sample: "{feat.sampleTitles[0]}"
                          </div>
                        )}
                      </td>

                      {/* Target Class */}
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[11px] font-extrabold text-indigo-700">
                          {feat.targetClass}
                        </span>
                      </td>

                      {/* Composite Score Bar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, feat.compositeScore)}%` }}
                            />
                          </div>
                          <span className="font-black text-slate-900 w-8 text-right text-xs">
                            {feat.compositeScore}
                          </span>
                        </div>
                      </td>

                      {/* Odds Ratio */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-black text-slate-900">
                          {feat.oddsRatio}x
                        </span>
                        <div className="text-[10px] text-slate-400">Relative Odds</div>
                      </td>

                      {/* In-Class vs Out-Class Percentages */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs font-bold text-emerald-600">
                          {feat.inClassRatioPct}% In-Cohort
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {feat.outClassRatioPct}% Out-Cohort
                        </div>
                      </td>

                      {/* 4 Model Coefficient Badges */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5 text-[10px]">
                          <span
                            title="Logistic Regression Weight (LR)"
                            className="rounded px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold border border-blue-100"
                          >
                            LR: {feat.logisticWeight}
                          </span>
                          <span
                            title="Random Forest Gini Importance (RF)"
                            className="rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-100"
                          >
                            RF: {feat.randomForestImportance}%
                          </span>
                          <span
                            title="Naive Bayes Log-Likelihood Ratio (NB LLR)"
                            className="rounded px-1.5 py-0.5 bg-purple-50 text-purple-700 font-bold border border-purple-100"
                          >
                            NB: {feat.naiveBayesLLR}
                          </span>
                          <span
                            title="Linear SVM Hyperplane Weight (SVM)"
                            className="rounded px-1.5 py-0.5 bg-amber-50 text-amber-800 font-bold border border-amber-100"
                          >
                            SVM: {feat.svmWeight}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Interactive Live Inference & Prediction Playground */}
      <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Interactive Multi-Model Inference Playground
              </h4>
              <p className="text-xs text-slate-500">
                Enter a prospective title and abstract to evaluate real-time simultaneous predictions and class probability posteriors across all 4 trained statistical classifiers.
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Quick Presets:</span>
            <button
              onClick={() => {
                setTestTitle("Deep Generative Diffusion for Molecular Conformation and Drug Binding");
                setTestAbstract("We develop continuous denoising diffusion probabilistic models over 3D atomic coordinates to synthesize novel bio-active ligands targeting oncogenic kinases.");
              }}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
            >
              Modern / Frontier Era
            </button>
            <button
              onClick={() => {
                setTestTitle("Classical Statistical Analysis of Clinical Trials and Epidemiological Cohorts");
                setTestAbstract("Standard multivariate regression models and linear analysis evaluating long-term survival rates across baseline hospital demographics.");
              }}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
            >
              Historical / Early Era
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Article Title
            </label>
            <input
              type="text"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="Enter paper title..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Article Abstract Text
            </label>
            <textarea
              rows={3}
              value={testAbstract}
              onChange={(e) => setTestAbstract(e.target.value)}
              placeholder="Paste or type abstract text here..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <button
            onClick={handleLivePredict}
            disabled={isPredicting || (!testTitle.trim() && !testAbstract.trim())}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
          >
            <Zap className={`h-4 w-4 ${isPredicting ? "animate-pulse" : ""}`} />
            {isPredicting ? "Classifying across 4 models..." : "Classify with 4 Models"}
          </button>
        </div>

        {/* Prediction Results Display */}
        {predictResult && predictResult.predictions && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Classification Posteriors across 4 Statistical Models:
              </h5>
              <span className="text-[11px] text-indigo-700 font-semibold">
                {predictResult.inputTokensCount} salient tokens extracted
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {modelOrder.map((mKey) => {
                const pred = predictResult.predictions[mKey];
                if (!pred) return null;

                return (
                  <div key={mKey} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {mKey === "logistic_regression"
                        ? "Logistic Regression"
                        : mKey === "random_forest"
                        ? "Random Forest"
                        : mKey === "naive_bayes"
                        ? "Naive Bayes"
                        : "Linear SVM"}
                    </div>
                    <div className="mt-1 text-sm font-black text-indigo-900">
                      {pred.predictedClass}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-emerald-600">
                      Confidence: {pred.confidence}%
                    </div>

                    {/* Class probabilities distribution */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      {pred.distribution?.map((dist: any, dIdx: number) => (
                        <div key={dIdx} className="text-[10px]">
                          <div className="flex justify-between text-slate-600">
                            <span className="truncate max-w-[120px]">{dist.className}</span>
                            <span className="font-bold">{dist.probability}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1 mt-0.5">
                            <div
                              className="bg-indigo-500 h-full rounded-full"
                              style={{ width: `${dist.probability}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detected Keywords in Input */}
            {predictResult.detectedKeywords && predictResult.detectedKeywords.length > 0 && (
              <div className="pt-2 text-xs">
                <span className="font-bold text-slate-700">Identified Features in TF-IDF Vocabulary: </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {predictResult.detectedKeywords.map((k: any, kidx: number) => (
                    <span
                      key={kidx}
                      className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 shadow-2xs"
                    >
                      {k.term} <span className="text-[9px] text-slate-400">(IDF: {k.idf})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Sample Documents Multi-Model Classification Log */}
      {results && results.sampleEvaluations && results.sampleEvaluations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" />
              Model Consensus & Evaluation Across Real Documents ({results.sampleEvaluations.length} Sample Papers)
            </h4>
            <span className="text-xs text-slate-500">
              Inspect inter-classifier consensus and disagreements on actual corpus records
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">Document Title</th>
                  <th className="px-3.5 py-2.5">Ground Truth</th>
                  <th className="px-3.5 py-2.5">Logistic Reg.</th>
                  <th className="px-3.5 py-2.5">Random Forest</th>
                  <th className="px-3.5 py-2.5">Naive Bayes</th>
                  <th className="px-3.5 py-2.5">Linear SVM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {results.sampleEvaluations.slice(0, 10).map((doc) => {
                  const checkMatch = (pred: string) => pred === doc.actualClass;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 max-w-sm truncate">
                        {doc.title}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                          {doc.actualClass}
                        </span>
                      </td>

                      {/* LR */}
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            checkMatch(doc.predictedByModel.logistic_regression)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {doc.predictedByModel.logistic_regression} ({doc.confidenceByModel.logistic_regression}%)
                        </span>
                      </td>

                      {/* RF */}
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            checkMatch(doc.predictedByModel.random_forest)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {doc.predictedByModel.random_forest} ({doc.confidenceByModel.random_forest}%)
                        </span>
                      </td>

                      {/* NB */}
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            checkMatch(doc.predictedByModel.naive_bayes)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {doc.predictedByModel.naive_bayes} ({doc.confidenceByModel.naive_bayes}%)
                        </span>
                      </td>

                      {/* SVM */}
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            checkMatch(doc.predictedByModel.linear_svm)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {doc.predictedByModel.linear_svm} ({doc.confidenceByModel.linear_svm}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
