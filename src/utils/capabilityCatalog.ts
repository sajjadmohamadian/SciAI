import type { Analysis, DatasetVersion } from "../types.js";
import type { NavTab } from "../components/Sidebar.js";

export const CAPABILITY_CATEGORIES = [
  "Corpus & Descriptive",
  "Citation Impact",
  "Authors & Productivity",
  "Sources & Journals",
  "Keywords & Themes",
  "Networks & Groups",
  "Institutions & Funding",
  "Historical References",
  "Machine Learning",
  "Other capabilities",
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];
export type EntityDimension = "authors" | "sources" | "institutions";

export interface CapabilityPresentation {
  title: string;
  category: CapabilityCategory;
  destination: NavTab;
  destinationLabel: string;
  requirement: string;
  dimension?: EntityDimension;
}

const descriptive = "Descriptive Analytics";
const entities = "Entity Explorer";

export const CAPABILITY_CATALOG: Record<string, CapabilityPresentation> = {
  "document.count": { title: "Corpus profile", category: "Corpus & Descriptive", destination: "descriptive", destinationLabel: descriptive, requirement: "Publication records and years" },
  "publication.year_distribution": { title: "Publication trends", category: "Corpus & Descriptive", destination: "descriptive", destinationLabel: descriptive, requirement: "Publication years; missing years are excluded" },
  "citation.total": { title: "Total citations", category: "Citation Impact", destination: "descriptive", destinationLabel: descriptive, requirement: "Citation counts; source coverage varies" },
  "citation.average": { title: "Average citations", category: "Citation Impact", destination: "descriptive", destinationLabel: descriptive, requirement: "Citation counts; outliers can skew the mean" },
  "citation.distribution": { title: "Citation distribution", category: "Citation Impact", destination: "descriptive", destinationLabel: descriptive, requirement: "Citation counts; distributions are often skewed" },
  "citation.window_adjusted": { title: "Citation-window adjustment", category: "Citation Impact", destination: "descriptive", destinationLabel: descriptive, requirement: "Publication years and citation counts" },
  "citation.field_normalized": { title: "Field-normalized citations", category: "Citation Impact", destination: "descriptive", destinationLabel: descriptive, requirement: "External field/year baselines; may be unavailable" },
  "keyword.frequency": { title: "Keyword frequency", category: "Keywords & Themes", destination: "descriptive", destinationLabel: descriptive, requirement: "Author or index keywords; normalize variants" },
  "funding.agency_distribution": { title: "Funding agencies", category: "Institutions & Funding", destination: "descriptive", destinationLabel: descriptive, requirement: "Funding acknowledgements; coverage may be incomplete" },
  "funding.grant_analytics": { title: "Grant analytics", category: "Institutions & Funding", destination: "descriptive", destinationLabel: descriptive, requirement: "Grant metadata and citations; association is not causation" },
  "author.productivity": { title: "Price's Elite Group", category: "Authors & Productivity", destination: "entities", destinationLabel: "Entity Explorer · Authors", dimension: "authors", requirement: "Author names; disambiguation affects rankings" },
  "citation.author_h_index": { title: "Author h-index and g-index", category: "Authors & Productivity", destination: "entities", destinationLabel: "Entity Explorer · Authors", dimension: "authors", requirement: "Author names and citations; corpus-specific indices" },
  "citation.advanced_hirsch": { title: "Advanced Hirsch metrics", category: "Authors & Productivity", destination: "entities", destinationLabel: "Entity Explorer · Authors", dimension: "authors", requirement: "Author names, citations, and publication years" },
  "author.lotka_law": { title: "Lotka’s law", category: "Authors & Productivity", destination: "entities", destinationLabel: "Entity Explorer · Authors", dimension: "authors", requirement: "Disambiguated authors and publication counts" },
  "source.productivity": { title: "Source productivity", category: "Sources & Journals", destination: "entities", destinationLabel: "Entity Explorer · Sources", dimension: "sources", requirement: "Normalized journal or venue names" },
  "source.bradford_law": { title: "Bradford’s law", category: "Sources & Journals", destination: "entities", destinationLabel: "Entity Explorer · Sources", dimension: "sources", requirement: "Sufficient sources and normalized venue names" },
  "institution.productivity": { title: "Institution productivity", category: "Institutions & Funding", destination: "entities", destinationLabel: "Entity Explorer · Institutions", dimension: "institutions", requirement: "Institutional affiliations; normalize name variants" },
  "author.co_authorship": { title: "Co-authorship", category: "Networks & Groups", destination: "collaboration", destinationLabel: "Network Studio", requirement: "Complete author lists; name disambiguation matters" },
  "group.analysis": { title: "Geographic and institutional groups", category: "Networks & Groups", destination: "collaboration", destinationLabel: "Network Studio", requirement: "Country and affiliation metadata; counting mode matters" },
  "group.comparative_significance": { title: "Comparative group significance", category: "Networks & Groups", destination: "collaboration", destinationLabel: "Network Studio · Group comparison", requirement: "Comparable groups; check chi-square assumptions" },
  "keyword.thematic_map": { title: "Strategic thematic map", category: "Keywords & Themes", destination: "thematic", destinationLabel: "Thematic Evolution", requirement: "Sufficient, consistently cleaned keywords" },
  "keyword.thematic_evolution": { title: "Thematic evolution", category: "Keywords & Themes", destination: "thematic", destinationLabel: "Thematic Evolution", requirement: "Sufficient keywords and records in each time slice" },
  "reference.rpys": { title: "Reference publication year spectroscopy", category: "Historical References", destination: "historical", destinationLabel: "HistCite & RPYS", requirement: "Cited-reference years; citation totals alone are insufficient" },
  "ml.kmeans_clusters": { title: "K-Means document clusters", category: "Machine Learning", destination: "ml", destinationLabel: "Machine Learning", requirement: "Document text; exploratory clusters require review" },
  "ml.lda_topics": { title: "LDA topic modeling", category: "Machine Learning", destination: "ml", destinationLabel: "Machine Learning", requirement: "Document text; topics require domain interpretation" },
  "ml.citation_prediction": { title: "Citation prediction", category: "Machine Learning", destination: "ml", destinationLabel: "Machine Learning", requirement: "Citation training data; predictions are not causal" },
  "ml.text_classification": { title: "Statistical text classification", category: "Machine Learning", destination: "ml", destinationLabel: "Machine Learning", requirement: "Text and viable target groups for cross-validation" },
};

export function getCapabilityPresentation(id: string): CapabilityPresentation {
  return CAPABILITY_CATALOG[id] || {
    title: id.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    category: "Other capabilities",
    destination: "descriptive",
    destinationLabel: descriptive,
    requirement: "Check the provider description for required metadata",
  };
}

export function getAnalysisCapabilityId(analysis: Analysis): string {
  return analysis.capability_id || analysis.analysis_type || analysis.result?.capability || "";
}

export function getAnalysisDatasetId(
  analysis: Analysis,
  versionOwners: Record<string, string>
): string | undefined {
  return analysis.dataset_version_id
    ? versionOwners[analysis.dataset_version_id] || analysis.dataset_id
    : analysis.dataset_id;
}

export function indexVersionOwners(versions: DatasetVersion[]): Record<string, string> {
  return Object.fromEntries(versions.map((version) => [version.id, version.dataset_id]));
}

export function getStudioRuns(
  analyses: Analysis[],
  destination: NavTab,
  datasetId: string,
  versionOwners: Record<string, string>
): Analysis[] {
  return analyses.filter((analysis) => {
    if (getCapabilityPresentation(getAnalysisCapabilityId(analysis)).destination !== destination) return false;
    const owner = getAnalysisDatasetId(analysis, versionOwners);
    return !owner || owner === datasetId;
  });
}
