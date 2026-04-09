<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# RAG Comparator (Groq + CHUB)

The app compares:
- Traditional response path (uploaded-document context + legacy style prompting)
- CHUB agentic path (uploaded-document context + latest GitHub API snippets)

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
`npm install`
2. Copy `.env.example` to `.env` and set:
`GROQ_API_KEY=...`
3. Run:
`npm run dev`

## Notes
- Upload files (`pdf`, `docx`, `txt`, `md`) and ask queries.
- CHUB comparison is method-based: traditional API call style vs latest API call style.
- Set `GITHUB_TOKEN` in `.env` to reduce GitHub API rate-limit issues.
