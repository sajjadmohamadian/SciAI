import { CanonicalDocument } from "../src/types.js";
import { createCanonicalDocument } from "./parsers/canonical.js";

// Sample Web of Science Plain Text Tagged format
export const SAMPLE_WOS_TXT = `PT J
AU Vaswani, Ashish
   Shazeer, Noam
   Parmar, Niki
   Uszkoreit, Jakob
   Jones, Llion
   Gomez, Aidan N.
   Kaiser, Lukasz
   Polosukhin, Illia
TI Attention Is All You Need
SO Advances in Neural Information Processing Systems
DE deep learning; transformers; attention mechanism; natural language processing
ID NEURAL NETWORKS; MACHINE TRANSLATION; COMPUTATIONAL LINGUISTICS
AB The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.
C1 [Vaswani, Ashish; Shazeer, Noam] Google Brain, Mountain View, CA, USA.
RP Vaswani, A (corresponding author), Google Brain, Mountain View, CA 94043 USA.
FU Google Brain Research; National Science Foundation (NSF) [IIS-1703450]
FX This work was supported by Google Brain and computational resources from NSF award IIS-1703450.
CR Hochreiter S, 1997, NEURAL COMPUT, V9, P1735, DOI 10.1162/neco.1997.9.8.1735
   Bahdanau D, 2014, ARXIV, DOI 10.48550/arXiv.1409.0473
TC 94500
PY 2017
VL 30
DI 10.48550/arXiv.1706.03762
UT WOS:000458921100023
ER

PT J
AU Doudna, Jennifer A.
   Charpentier, Emmanuelle
TI The new frontier of genome engineering with CRISPR-Cas9
SO Science
DE crispr; cas9; genome editing; molecular biology; rna-guided endonuclease
ID BACTERIAL IMMUNITY; GENE EDITING; THERAPEUTICS
AB The advent of facile, targeted genome editing using RNA-programmable enzymes of the CRISPR-Cas9 type has transformed genetic research across organisms.
C1 [Doudna, Jennifer A.] University of California, Berkeley, Department of Molecular and Cell Biology, Berkeley, CA, USA.
   [Charpentier, Emmanuelle] Max Planck Institute for Infection Biology, Berlin, Germany.
RP Doudna, JA (corresponding author), Univ Calif Berkeley, Dept Mol & Cell Biol, Berkeley, CA 94720 USA.
FU National Institutes of Health (NIH) [DP1-GM105378, R01-GM065840]; Howard Hughes Medical Institute (HHMI); National Science Foundation [MCB-1244512]
FX Research reported in this publication was supported by the NIH Director's Pioneer Award (DP1-GM105378), HHMI, and the National Science Foundation.
CR Jinek M, 2012, SCIENCE, V337, P816, DOI 10.1126/science.1225829
TC 4120
PY 2014
VL 346
IS 6213
DI 10.1126/science.1258096
UT WOS:000345610200001
ER

PT J
AU Van Eck, Nees Jan
   Waltman, Ludo
TI Software survey: VOSviewer, a computer program for bibliometric mapping
SO Scientometrics
DE bibliometric mapping; vosviewer; software; co-citation; co-occurrence
ID CLUSTER ANALYSIS; CITATION ANALYSIS; VISUALIZATION
AB We present VOSviewer, a freely available computer program that can be used for constructing and viewing bibliometric maps with advanced clustering.
C1 [Van Eck, Nees Jan; Waltman, Ludo] Centre for Science and Technology Studies (CWTS), Leiden University, Leiden, Netherlands.
RP Van Eck, NJ (corresponding author), Leiden Univ, CWTS, P.O. Box 905, 2300 AX Leiden, Netherlands.
FU Netherlands Organisation for Scientific Research (NWO) [400-08-012]; European Commission [FP7-217823]
FX The authors acknowledge funding from the Netherlands Organisation for Scientific Research (NWO) under project 400-08-012.
CR Small H, 1973, J AM SOC INFORM SCI, V24, P265
TC 3890
PY 2010
VL 84
IS 2
BP 523
EP 538
DI 10.1007/s11192-009-0146-3
UT WOS:000280145200021
ER
`;

// Sample Scopus CSV format
export const SAMPLE_SCOPUS_CSV = `Authors,"Author(s) ID",Title,Year,"Source title",Volume,Issue,"Art. No.","Page start","Page end","Page count","Cited by",DOI,Link,Affiliations,"Authors with affiliations",Abstract,"Author Keywords","Index Keywords",References,"Correspondence Address",Publisher,ISSN,ISBN,CODEN,"PubMed ID","Language of Original Document","Abbreviated Source Title","Document Type","Publication Stage","Open Access",Source,EID,"Funding Details","Funding Sponsor","Funding Number","Funding Text 1"
"Vaswani, A.; Shazeer, N.; Parmar, N.; Uszkoreit, J.; Jones, L.; Gomez, A.N.; Kaiser, L.; Polosukhin, I.","57201452300;57201452301","Attention is all you need",2017,"Advances in Neural Information Processing Systems",30,,,"5998","6008",11,"98200","10.48550/arXiv.1706.03762","https://scopus.com/inward/record.uri","Google Research, Mountain View, CA, United States","Vaswani, A., Google Brain; Shazeer, N., Google Research","The Transformer architecture relies entirely on self-attention mechanisms without recurrence or convolution.","Transformers; Self-Attention; Deep Learning; NLP","Machine translation; Neural networks","Hochreiter, S., Schmidhuber, J., Long short-term memory (1997) Neural Comput., 9 (8), pp. 1735-1780","Vaswani, A., Google","Neural Information Processing Systems Foundation",10495258,,,,"English","Adv. Neural Inf. Process. Syst.","Conference Paper","final","All Open Access","Scopus","2-s2.0-85041928491","National Science Foundation [IIS-1703450]; Google Brain","National Science Foundation","IIS-1703450","This work was supported by Google Research and NSF grant IIS-1703450."
"Aria, Massimo; Cuccurullo, Corrado","55621458900;55621458901","bibliometrix: An R-tool for comprehensive science mapping analysis",2017,"Journal of Informetrics",11,4,,"959","975",17,"4620","10.1016/j.joi.2017.08.007","https://scopus.com/inward/record.uri","Department of Economics and Statistics, University of Naples Federico II, Naples, Italy","Aria, M., University of Naples; Cuccurullo, C., University of Campania","Science mapping is an indispensable technique in bibliometrics. In this paper we introduce bibliometrix, an open-source tool programmed in R.","bibliometrics; science mapping; R package; co-citation; biblioshiny","Scientometrics; Data mining; Visualization","White, H.D., McCain, K.W., Visualizing a discipline (1998) J. Am. Soc. Inf. Sci., 49, pp. 327-355","Aria, M., Naples, Italy","Elsevier",17511577,,,,"English","J. Informetr.","Article","final","Gold Open Access","Scopus","2-s2.0-85029384912","Italian Ministry of University and Research (MUR) [PRIN-2015-XY901]","Italian Ministry of University and Research","PRIN-2015-XY901","Supported by Italian Ministry of University and Research PRIN grant 2015-XY901."
"Börner, Katy; Chen, Chaomei; Boyack, Kevin W.","7004128900;7004128901;7004128902","Visualizing knowledge domains",2003,"Annual Review of Information Science and Technology",37,1,,"179","255",77,"1950","10.1002/aris.1440370106","https://scopus.com/inward/record.uri","School of Library and Information Science, Indiana University, Bloomington, IN, United States","Börner, K., Indiana University","Visualizing knowledge domains is an emerging interdisciplinary field that seeks to map scientific disciplines and track frontiers.","Domain visualization; Knowledge mapping; Citation networks; Co-citation","Information science; Scientific discovery","Small, H., Co-citation in the scientific literature (1973) JASIS, 24, pp. 265-269","Börner, K., Bloomington","Information Today",00664200,,,,"English","Annu. Rev. Inf. Sci. Technol.","Review","final",,"Scopus","2-s2.0-03463920192","National Science Foundation [IIS-0219356]; National Institutes of Health [P01-AG020166]","National Science Foundation","IIS-0219356; P01-AG020166","Supported by NSF award IIS-0219356 and NIH P01-AG020166."
`;

// Sample PubMed MEDLINE Tagged format
export const SAMPLE_PUBMED_NBIB = `PMID- 25430764
OWN - NLM
STAT- MEDLINE
DA  - 20141128
DCOM- 20150120
LR  - 20211020
IS  - 1095-9203 (Electronic)
VI  - 346
IP  - 6213
DP  - 2014 Nov 28
TI  - The new frontier of genome engineering with CRISPR-Cas9.
PG  - 1258096
LID - 10.1126/science.1258096 [doi]
AB  - The advent of facile, targeted genome editing using RNA-programmable enzymes such as CRISPR-Cas9 has revolutionized molecular biology and biotechnology. We review the biochemical mechanism of Cas9 endonuclease and therapeutic potentials.
FAU - Doudna, Jennifer A
AU  - Doudna JA
AD  - Department of Molecular and Cell Biology, University of California, Berkeley, CA 94720, USA.
FAU - Charpentier, Emmanuelle
AU  - Charpentier E
AD  - Department of Regulation in Infection Biology, Max Planck Institute for Infection Biology, D-10117 Berlin, Germany.
LA  - eng
PT  - Journal Article
PT  - Review
TA  - Science
JT  - Science (New York, N.Y.)
MH  - CRISPR-Cas Systems/genetics*
MH  - Gene Editing/methods*
MH  - RNA, Guide/genetics
MH  - Animals
MH  - Humans
AID - 10.1126/science.1258096 [doi]
PST - ppublish
SO  - Science. 2014 Nov 28;346(6213):1258096.

PMID- 32422648
OWN - NLM
STAT- MEDLINE
DP  - 2020 Jul
TI  - Clinical and epidemiological characteristics of 3D radiological findings in COVID-19.
FAU - Guan, Wei-Jie
AU  - Guan WJ
FAU - Zhong, Nan-Shan
AU  - Zhong NS
AD  - State Key Laboratory of Respiratory Disease, National Clinical Research Center for Respiratory Disease, Guangzhou, China.
LID - 10.1056/NEJMoa2002032 [doi]
AB  - During the early outbreak of coronavirus disease 2019 (COVID-19), we extracted data on laboratory-confirmed cases to delineate clinical features, laboratory indexes, and pulmonary CT patterns.
LA  - eng
PT  - Journal Article
TA  - N Engl J Med
JT  - The New England journal of medicine
MH  - COVID-19/epidemiology*
MH  - Tomography, X-Ray Computed
MH  - SARS-CoV-2
AID - 10.1056/NEJMoa2002032 [doi]
SO  - N Engl J Med. 2020;382(18):1708-1720.
`;

// Sample OpenAlex JSON format
export const SAMPLE_OPENALEX_JSON = JSON.stringify({
  results: [
    {
      id: "https://openalex.org/W2741809807",
      doi: "https://doi.org/10.48550/arxiv.1706.03762",
      title: "Attention Is All You Need",
      display_name: "Attention Is All You Need",
      publication_year: 2017,
      publication_date: "2017-06-12",
      cited_by_count: 102450,
      primary_location: {
        source: {
          display_name: "Advances in Neural Information Processing Systems",
          id: "https://openalex.org/S4306400194",
        },
      },
      authorships: [
        {
          author: {
            display_name: "Ashish Vaswani",
            id: "https://openalex.org/A5016259021",
            orcid: "https://orcid.org/0000-0002-1234-5678",
          },
          institutions: [{ display_name: "Google (United States)", country_code: "US" }],
        },
        {
          author: {
            display_name: "Noam Shazeer",
            id: "https://openalex.org/A5027412891",
          },
          institutions: [{ display_name: "Google (United States)", country_code: "US" }],
        },
      ],
      concepts: [
        { display_name: "Transformer" },
        { display_name: "Artificial intelligence" },
        { display_name: "Machine translation" },
      ],
      abstract_inverted_index: {
        "The": [0],
        "Transformer": [1],
        "is": [2],
        "the": [3],
        "first": [4],
        "transduction": [5],
        "model": [6],
        "relying": [7],
        "entirely": [8],
        "on": [9],
        "self-attention.": [10],
      },
    },
    {
      id: "https://openalex.org/W2963402931",
      doi: "https://doi.org/10.1038/s41586-020-2003-x",
      title: "A pneumonia outbreak associated with a new coronavirus of probable bat origin",
      display_name: "A pneumonia outbreak associated with a new coronavirus of probable bat origin",
      publication_year: 2020,
      cited_by_count: 18450,
      primary_location: {
        source: {
          display_name: "Nature",
        },
      },
      authorships: [
        {
          author: {
            display_name: "Peng Zhou",
            orcid: "https://orcid.org/0000-0001-9876-5432",
          },
          institutions: [{ display_name: "Wuhan Institute of Virology, Chinese Academy of Sciences" }],
        },
        {
          author: { display_name: "Zheng-Li Shi" },
          institutions: [{ display_name: "Wuhan Institute of Virology, Chinese Academy of Sciences" }],
        },
      ],
      concepts: [{ display_name: "Virology" }, { display_name: "Coronavirus" }, { display_name: "Epidemiology" }],
    },
  ],
});

// Sample Dimensions CSV format
export const SAMPLE_DIMENSIONS_CSV = `"Publication ID",DOI,PMID,Title,"Source title",Volume,Issue,Pagination,PubYear,"Publication Date",Authors,"Authors (Raw Affiliation)","Research Organizations - standardized","Country of Research Organization","Times cited","Recent citations","MeSH terms","Field of Research (ANZSRC 2020)","Publication Type",Abstract
"pub.1089201481","10.1016/j.joi.2017.08.007",,"bibliometrix: An R-tool for comprehensive science mapping analysis","Journal of Informetrics",11,4,"959-975",2017,"2017-11-01","Massimo Aria; Corrado Cuccurullo","Massimo Aria (University of Naples Federico II); Corrado Cuccurullo (University of Campania)","University of Naples Federico II","Italy",4750,1120,"Bibliometrics; Information Systems","4605 Data management and data science; 4608 Human-centred computing","Article","The open-source R package bibliometrix provides tools for quantitative research in scientometrics and bibliometrics."
"pub.1023910245","10.1007/s11192-009-0146-3",,"Software survey: VOSviewer, a computer program for bibliometric mapping","Scientometrics",84,2,"523-538",2010,"2010-08-01","Nees Jan van Eck; Ludo Waltman","Nees Jan van Eck (Leiden University); Ludo Waltman (Leiden University)","Leiden University","Netherlands",3990,890,"Information Science; Bibliometric Mapping","4602 Artificial intelligence; 4605 Data management","Article","This software survey describes VOSviewer, an interactive tool for visualizing citation and co-occurrence graphs."
"pub.1102934812","10.1038/s41586-020-2649-2","32747970","Clinical features of patients infected with 2019 novel coronavirus in Wuhan, China","Nature",586,7831,"740-745",2020,"2020-08-01","Chaolin Huang; Yeming Wang; Xingwang Li","Chaolin Huang (Jin Yin-tan Hospital, Wuhan)","Jin Yin-tan Hospital","China",16200,3100,"Coronavirus; Pneumonia; Infectious Disease","3202 Clinical sciences; 3207 Medical microbiology","Article","Coronaviruses are important human pathogens. Here we report the clinical course of patients diagnosed with novel coronavirus pneumonia."
`;

// Sample Lens.org CSV format
export const SAMPLE_LENS_CSV = `"Lens ID",Title,"Date Published","Publication Year","Publication Type","Source Title",ISSNs,Publisher,Volume,IssueNumber,"Start Page","End Page","Fields of Study",Keywords,Authors,"Author Affiliations",Abstract,DOI,PMID,"Citing Works Count"
"042-891-234-912-841","Attention Is All You Need","2017-12-06",2017,"journal article","Neural Information Processing Systems",,"Curran Associates",30,,"5998","6008","Computer Science; Artificial Intelligence; Transformer","Self-Attention; Machine Learning","Ashish Vaswani; Noam Shazeer; Niki Parmar; Jakob Uszkoreit","Google Brain, USA","Transformer sequence modeling architecture based on multi-head attention.","10.48550/arXiv.1706.03762",,98900
"182-901-445-123-900","Visualizing knowledge domains","2003-01-01",2003,"review article","Annual Review of Information Science and Technology",0066-4200,"Information Today, Inc.",37,1,"179","255","Information Science; Bibliometrics; Science Mapping","Domain Mapping; Scientometrics","Katy Börner; Chaomei Chen; Kevin W. Boyack","Indiana University, Bloomington","An in-depth review of algorithms and graph layout frameworks for domain visualization.","10.1002/aris.1440370106",,2010
"099-123-556-781-334","The new frontier of genome engineering with CRISPR-Cas9","2014-11-28",2014,"journal article","Science",0036-8075,"American Association for the Advancement of Science",346,6213,"1258096","1258096","Genetics; Molecular Biology; CRISPR","Cas9; Endonuclease; Gene Editing","Jennifer A. Doudna; Emmanuelle Charpentier","UC Berkeley; Max Planck Institute","CRISPR-Cas9 bacterial immune machinery repurposed for site-specific genomic modifications.","10.1126/science.1258096","25430764",4250
`;
