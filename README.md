# Middle School Science Bowl

This is the working repository for our middle-school Science Bowl team. It preserves a searchable archive of DOE practice material and provides a shared foundation for subject preparation.

The current emphasis is **mathematics**: as the mathematics chair, this is where I will curate math-focused practice, references, and analysis. The complete archive remains useful for interdisciplinary rounds and team-wide preparation.

## Repository architecture

```text
scibowl/
├── README.md                 # Team purpose, navigation, and conventions
├── subjects/
│   ├── subjects.md           # Subject labels and math-focused coverage context
│   └── mathematics/          # Math-chair materials, organized by use
├── past exams/
│   ├── *.pdf                 # 251 DOE middle-school question packets
│   └── MANIFEST.csv          # Local filename-to-source-URL map
└── analytics/
    └── pdf_inventory.md      # Pages, question markers, and labels per PDF
```

## Start here

- [`subjects/subjects.md`](subjects/subjects.md) - all detected subject labels, including Math and Mathematics.
- [`subjects/mathematics/`](subjects/mathematics/) - mathematics-chair materials and practice resources.
- [`subjects/mathematics/topics.md`](subjects/mathematics/topics.md) - the mathematics topic map derived from past exams.
- [`past exams/`](past%20exams/) - the full DOE question-packet archive.
- [`analytics/pdf_inventory.md`](analytics/pdf_inventory.md) - find packets by their detected topic labels.

## Mathematics focus

Use the archive and inventory to locate packets labeled **Math** or **Mathematics**. Future mathematics-chair material should live in a clearly named math-focused location under `subjects/` so team members can find it without mixing it with the source archive.

## Naming

PDF filenames are lowercase. Standard set-round files use `msnsb_set##_round##.pdf`; supplemental DOE files retain a lowercase descriptive name. `past exams/MANIFEST.csv` maps each local file to its original DOE URL.

## Source

The PDFs were collected from the [DOE National Science Bowl Middle School Sample Questions page](https://science.osti.gov/wdts/nsb/Regional-Competitions/Resources/MS-Sample-Questions). Historical questions and answers may need current factual verification.
