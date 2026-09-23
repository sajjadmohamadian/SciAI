import { BibliometricDocument } from "../src/types.js";

export function getSeedDocuments(): Record<string, BibliometricDocument[]> {
  // 1. Biomedical AI Dataset
  const biomedicalDocs: BibliometricDocument[] = [
    {
      id: "bio-1",
      title: "Deep learning models for early detection of clinical sepsis from electronic health records",
      authors: ["Mohamadian, S.", "Khorasani, A.", "Chen, W.", "Miller, E."],
      year: 2024,
      source: "Journal of Biomedical Informatics",
      citations: 142,
      keywords: ["deep learning", "sepsis", "electronic health records", "clinical decision support", "machine learning"],
      abstract: "Early intervention in sepsis saves lives. We developed a temporal deep neural network evaluating high-dimensional physiological time series.",
      doi: "10.1016/j.jbi.2024.104521",
      country: "Iran",
    },
    {
      id: "bio-2",
      title: "Self-supervised representation learning for multi-modal histopathological whole-slide imaging",
      authors: ["Zhang, Y.", "Mohamadian, S.", "Rahmani, M.", "LeCun, B."],
      year: 2023,
      source: "IEEE Transactions on Medical Imaging",
      citations: 215,
      keywords: ["histopathology", "self-supervised learning", "cancer diagnosis", "deep learning", "computer vision"],
      abstract: "Whole slide imaging requires handling gigapixel resolutions. Our contrastive learning framework aggregates patch-level embeddings.",
      doi: "10.1109/TMI.2023.3289011",
      country: "United States",
    },
    {
      id: "bio-3",
      title: "Graph neural networks for drug-target interaction prediction using biomedical knowledge graphs",
      authors: ["Mohamadian, S.", "Ghasemi, F.", "Smith, J. R."],
      year: 2023,
      source: "Bioinformatics",
      citations: 98,
      keywords: ["knowledge graph", "drug discovery", "graph neural networks", "bioinformatics", "molecular embeddings"],
      abstract: "Predicting novel drug target interactions accelerates discovery. We propose a relational graph convolutional network.",
      doi: "10.1093/bioinformatics/btad312",
      country: "Iran",
    },
    {
      id: "bio-4",
      title: "Large language models in clinical medicine: systematic review of benchmarks and diagnostic accuracy",
      authors: ["Chen, W.", "Miller, E.", "Wang, T.", "Al-Mansoor, K."],
      year: 2024,
      source: "The Lancet Digital Health",
      citations: 310,
      keywords: ["large language models", "clinical evaluation", "diagnostic reasoning", "artificial intelligence", "patient safety"],
      abstract: "Comprehensive systematic assessment of foundation models evaluated on multi-specialty clinical examinations and case benchmarks.",
      doi: "10.1016/S2589-7500(24)00012-8",
      country: "United Kingdom",
    },
    {
      id: "bio-5",
      title: "Automated extraction of biological expression language statements from PubMed literature",
      authors: ["Mohamadian, S.", "Khorasani, A.", "Fluck, J."],
      year: 2022,
      source: "Database: The Journal of Biological Databases and Curation",
      citations: 74,
      keywords: ["biological expression language", "text mining", "biocuration", "pubmed", "named entity recognition"],
      abstract: "Translating unstructured scientific text into computable biological networks through OpenBEL semantic relation parsing.",
      doi: "10.1093/database/baac045",
      country: "Germany",
    },
    {
      id: "bio-6",
      title: "Explainable artificial intelligence in cardiac arrhythmia classification: attention maps and feature attribution",
      authors: ["Rahmani, M.", "Ghasemi, F.", "Zhang, Y."],
      year: 2022,
      source: "Artificial Intelligence in Medicine",
      citations: 88,
      keywords: ["explainable ai", "ecg classification", "arrhythmia", "deep learning", "interpretability"],
      doi: "10.1016/j.artmed.2022.102380",
      country: "Iran",
    },
    {
      id: "bio-7",
      title: "Federated learning protocols for multi-institutional genomic variant association studies",
      authors: ["Miller, E.", "Mohamadian, S.", "Smith, J. R."],
      year: 2024,
      source: "Nature Machine Intelligence",
      citations: 165,
      keywords: ["federated learning", "genomics", "privacy-preserving", "gwas", "distributed computing"],
      doi: "10.1038/s42256-024-00812-4",
      country: "United States",
    },
    {
      id: "bio-8",
      title: "Bibliometric evolution of medical artificial intelligence: a decade of quantitative scientometrics",
      authors: ["Mohamadian, S.", "Wang, T."],
      year: 2025,
      source: "Scientometrics",
      citations: 34,
      keywords: ["scientometrics", "bibliometrics", "medical ai", "co-authorship", "lotka law", "citation analysis"],
      doi: "10.1007/s11192-025-04981-2",
      country: "Iran",
    },
    {
      id: "bio-9",
      title: "Clinical NLP for automated adverse drug event surveillance across unstructured clinical narratives",
      authors: ["Khorasani, A.", "Chen, W.", "Al-Mansoor, K."],
      year: 2021,
      source: "Journal of the American Medical Informatics Association",
      citations: 119,
      keywords: ["natural language processing", "adverse drug events", "clinical nlp", "pharmacovigilance"],
      doi: "10.1093/jamia/ocaa294",
      country: "United Kingdom",
    },
    {
      id: "bio-10",
      title: "Diffusion models for synthetic medical image generation and data augmentation in rare diseases",
      authors: ["Zhang, Y.", "LeCun, B.", "Chen, W."],
      year: 2024,
      source: "IEEE Transactions on Medical Imaging",
      citations: 184,
      keywords: ["diffusion models", "data augmentation", "medical imaging", "synthetic data", "deep learning"],
      doi: "10.1109/TMI.2024.3367120",
      country: "United States",
    },
    {
      id: "bio-11",
      title: "Zero-shot protein fitness prediction using evolutionary scale language modeling",
      authors: ["Smith, J. R.", "Miller, E.", "Wang, T."],
      year: 2023,
      source: "Nature Biotechnology",
      citations: 285,
      keywords: ["protein language models", "zero-shot", "bioinformatics", "protein engineering", "evolutionary dynamics"],
      doi: "10.1038/s41587-023-01793-0",
      country: "United States",
    },
    {
      id: "bio-12",
      title: "Knowledge graph embeddings for multi-hop biomedical question answering",
      authors: ["Mohamadian, S.", "Khorasani, A.", "Rahmani, M."],
      year: 2021,
      source: "Journal of Biomedical Informatics",
      citations: 92,
      keywords: ["knowledge graph", "question answering", "graph embeddings", "clinical decision support", "natural language processing"],
      doi: "10.1016/j.jbi.2021.103841",
      country: "Iran",
    },
    {
      id: "bio-13",
      title: "Transformers in medical imaging: Swin-UNet architectures for semantic segmentation",
      authors: ["Zhang, Y.", "Rahmani, M.", "LeCun, B."],
      year: 2022,
      source: "Medical Image Analysis",
      citations: 240,
      keywords: ["transformers", "semantic segmentation", "medical imaging", "swin transformer", "deep learning"],
      doi: "10.1016/j.media.2022.102450",
      country: "United States",
    },
    {
      id: "bio-14",
      title: "Ethical guidelines and regulatory frameworks for clinical AI deployment in healthcare systems",
      authors: ["Wang, T.", "Al-Mansoor, K.", "Chen, W."],
      year: 2023,
      source: "The Lancet Digital Health",
      citations: 78,
      keywords: ["bioethics", "ai regulation", "clinical governance", "healthcare policy", "bias mitigation"],
      doi: "10.1016/S2589-7500(23)00145-2",
      country: "United Kingdom",
    },
    {
      id: "bio-15",
      title: "Continuous physiological stream analysis using lightweight edge transformers in intensive care units",
      authors: ["Mohamadian, S.", "Ghasemi, F.", "Khorasani, A."],
      year: 2025,
      source: "Artificial Intelligence in Medicine",
      citations: 28,
      keywords: ["edge computing", "intensive care unit", "physiological monitoring", "real-time analytics", "deep learning"],
      doi: "10.1016/j.artmed.2025.102990",
      country: "Iran",
    },
    {
      id: "bio-16",
      title: "Multi-omics integration using variational autoencoders for biomarker discovery in oncology",
      authors: ["Miller, E.", "Smith, J. R.", "Zhang, Y."],
      year: 2021,
      source: "Bioinformatics",
      citations: 167,
      keywords: ["multi-omics", "variational autoencoder", "biomarkers", "oncology", "cancer genomics"],
      doi: "10.1093/bioinformatics/btab501",
      country: "United States",
    },
    {
      id: "bio-17",
      title: "Active learning strategies for scalable biocuration of disease-gene associations",
      authors: ["Khorasani, A.", "Mohamadian, S.", "Fluck, J."],
      year: 2020,
      source: "Database: The Journal of Biological Databases and Curation",
      citations: 62,
      keywords: ["active learning", "biocuration", "disease-gene associations", "text mining", "machine learning"],
      doi: "10.1093/database/baaa089",
      country: "Germany",
    },
    {
      id: "bio-18",
      title: "Fairness and demographic parity in algorithmic clinical triage: an empirical study",
      authors: ["Al-Mansoor, K.", "Chen, W.", "Wang, T."],
      year: 2024,
      source: "Journal of the American Medical Informatics Association",
      citations: 56,
      keywords: ["algorithmic bias", "fairness", "clinical triage", "healthcare equity", "evaluation"],
      doi: "10.1093/jamia/ocae088",
      country: "United Kingdom",
    },
    {
      id: "bio-19",
      title: "Deep reinforcement learning for adaptive insulin dosing in type 1 diabetes management",
      authors: ["Rahmani, M.", "Ghasemi, F.", "Mohamadian, S."],
      year: 2023,
      source: "IEEE Transactions on Biomedical Engineering",
      citations: 104,
      keywords: ["reinforcement learning", "diabetes", "insulin dosing", "artificial pancreas", "control systems"],
      doi: "10.1109/TBME.2023.3245601",
      country: "Iran",
    },
    {
      id: "bio-20",
      title: "Digital twins in personalized cardiology: computational mechanics and machine learning synergy",
      authors: ["Smith, J. R.", "Zhang, Y.", "Miller, E."],
      year: 2025,
      source: "Nature Machine Intelligence",
      citations: 45,
      keywords: ["digital twin", "cardiology", "hemodynamics", "physics-informed neural networks", "personalized medicine"],
      doi: "10.1038/s42256-025-00910-1",
      country: "United States",
    }
  ];

  // 2. Genomics & CRISPR
  const crisprDocs: BibliometricDocument[] = [
    {
      id: "cr-1",
      title: "Genome-wide off-target profiling of prime editing systems across human cell lines",
      authors: ["Doudna, J. A.", "Charpentier, E.", "Sternberg, S. H."],
      year: 2021,
      source: "Nature Genetics",
      citations: 480,
      keywords: ["crispr-cas9", "prime editing", "off-target profiling", "genome editing", "genomics"],
      country: "United States",
    },
    {
      id: "cr-2",
      title: "High-throughput single-cell CRISPR screening reveals transcriptional regulators of immune evasion",
      authors: ["Zhang, F.", "Sternberg, S. H.", "Liu, D. R."],
      year: 2022,
      source: "Cell",
      citations: 395,
      keywords: ["crispr screen", "single-cell rna-seq", "immunotherapy", "transcriptomics"],
      country: "United States",
    },
    {
      id: "cr-3",
      title: "Engineering high-fidelity Cas12a nucleases for targeted therapeutic genome correction",
      authors: ["Charpentier, E.", "Mohamadian, S.", "Muller, K."],
      year: 2023,
      source: "Nature Biotechnology",
      citations: 210,
      keywords: ["cas12a", "gene therapy", "protein engineering", "crispr-cas9", "rare disease"],
      country: "Germany",
    },
    {
      id: "cr-4",
      title: "Epigenome editing using CRISPR-dCas9 conjugated with DNA methyltransferases in neurodegenerative models",
      authors: ["Muller, K.", "Zhang, F.", "Liu, D. R."],
      year: 2024,
      source: "Science Advances",
      citations: 132,
      keywords: ["epigenomics", "dcas9", "dna methylation", "neurodegeneration", "gene regulation"],
      country: "Germany",
    },
    {
      id: "cr-5",
      title: "In vivo delivery platforms for base and prime editors using targeted lipid nanoparticles",
      authors: ["Liu, D. R.", "Doudna, J. A.", "Sternberg, S. H."],
      year: 2024,
      source: "Nature Reviews Drug Discovery",
      citations: 290,
      keywords: ["lipid nanoparticles", "in vivo delivery", "base editing", "mrna therapeutics"],
      country: "United States",
    }
  ];

  function enrichSeedDoc(doc: BibliometricDocument): BibliometricDocument {
    let insts: string[] = [];
    let affils: string[] = [];
    let agencies: string[] = [];
    let grants: string[] = [];
    let fundingText = "";

    if (doc.country === "Iran") {
      insts = ["Tehran University of Medical Sciences", "Sharif University of Technology"];
      affils = [
        `Department of Medical Informatics, Tehran University of Medical Sciences, Tehran, Iran`,
        `Department of Computer Engineering, Sharif University of Technology, Tehran, Iran`
      ];
      agencies = ["National Institute for Medical Research Development (NIMAD)", "Iran National Science Foundation (INSF)"];
      grants = [`NIMAD-${doc.year}-99214`, `INSF-4001289`];
      fundingText = `This study was supported by a research grant from the National Institute for Medical Research Development (NIMAD grant NIMAD-${doc.year}-99214) and INSF (grant 4001289).`;
    } else if (doc.country === "United States") {
      insts = ["Harvard Medical School", "Broad Institute of MIT and Harvard", "University of California, Berkeley"];
      affils = [
        `Department of Biomedical Informatics, Harvard Medical School, Boston, MA, USA`,
        `Broad Institute of MIT and Harvard, Cambridge, MA, USA`,
        `Department of Molecular and Cell Biology, University of California, Berkeley, CA, USA`
      ];
      agencies = ["National Institutes of Health (NIH)", "National Science Foundation (NSF)", "Howard Hughes Medical Institute (HHMI)"];
      grants = [`R01-LM013245`, `U54-CA225088`, `IIS-204123`];
      fundingText = `Research reported in this publication was supported by the National Institutes of Health (NIH R01-LM013245), the National Science Foundation (NSF IIS-204123), and HHMI.`;
    } else if (doc.country === "United Kingdom") {
      insts = ["University of Oxford", "The Alan Turing Institute", "University College London"];
      affils = [
        `Nuffield Department of Medicine, University of Oxford, Oxford, UK`,
        `The Alan Turing Institute, British Library, London, UK`
      ];
      agencies = ["Medical Research Council (MRC)", "Wellcome Trust", "UK Research and Innovation (UKRI)"];
      grants = [`MRC-MR/T02345/1`, `WT218453/Z/19/Z`];
      fundingText = `This research was funded in whole by the Wellcome Trust (WT218453/Z/19/Z) and the Medical Research Council (MRC-MR/T02345/1).`;
    } else if (doc.country === "Germany") {
      insts = ["Max Planck Institute for Infection Biology", "Charité – Universitätsmedizin Berlin", "Heidelberg University"];
      affils = [
        `Max Planck Institute for Infection Biology, Charitéplatz 1, Berlin, Germany`,
        `Berlin Institute of Health at Charité – Universitätsmedizin Berlin, Germany`
      ];
      agencies = ["Deutsche Forschungsgemeinschaft (DFG)", "European Research Council (ERC)"];
      grants = [`DFG-EXC-2048/1`, `ERC-2020-AdG-89104`];
      fundingText = `Funded by the Deutsche Forschungsgemeinschaft (DFG, German Research Foundation) under Germany's Excellence Strategy - EXC 2048/1 and the European Research Council (ERC-2020-AdG-89104).`;
    } else {
      insts = ["Centre for Science and Technology Studies (CWTS), Leiden University"];
      affils = [`CWTS, Leiden University, Leiden, Netherlands`];
      agencies = ["European Commission (Horizon 2020)", "Netherlands Organisation for Scientific Research (NWO)"];
      grants = [`NWO-400-08-012`, `H2020-824510`];
      fundingText = `Supported by the European Commission Horizon 2020 research programme (Grant 824510) and NWO project 400-08-012.`;
    }

    return {
      ...doc,
      affiliations: doc.affiliations && doc.affiliations.length > 0 ? doc.affiliations : affils,
      institutions: doc.institutions && doc.institutions.length > 0 ? doc.institutions : insts,
      funding_agencies: doc.funding_agencies && doc.funding_agencies.length > 0 ? doc.funding_agencies : agencies,
      grant_numbers: doc.grant_numbers && doc.grant_numbers.length > 0 ? doc.grant_numbers : grants,
      funding_text: doc.funding_text || fundingText,
      FU: agencies.map((a, i) => `${a} [${grants[i] || "N/A"}]`),
      FX: fundingText,
      countries: doc.country ? [doc.country] : ["International"],
      reprint_address: affils[0] ? `${doc.authors[0]} (corresponding author), ${affils[0]}` : undefined,
    };
  }

  return {
    "dataset-bio-1": biomedicalDocs.map(enrichSeedDoc),
    "dataset-crispr-2": crisprDocs.map(enrichSeedDoc),
  };
}
