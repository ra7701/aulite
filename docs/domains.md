# Compliance Domains

Aulite organizes compliance rules into domain-specific packs aligned with the 8 high-risk categories defined in EU AI Act Annex III. Base rules (Art. 5 prohibitions, GDPR Art. 9) are always active.

## Available Domains

| Domain | Annex III | Rules | Description |
|---|---|---|---|
| `hr` | Point 4 | 33 | Employment, recruitment, HR decisions |
| `finance` | Point 5 | 13 | Credit scoring, insurance, financial services |
| `biometrics` | Point 1 | 12 | Biometric identification and categorisation |
| `education` | Point 3 | 13 | Education access, assessment, proctoring |
| `infrastructure` | Point 2 | 12 | Critical infrastructure safety components |
| `law-enforcement` | Point 6 | 14 | Law enforcement AI applications |
| `migration` | Point 7 | 13 | Migration, asylum, border control |
| `justice` | Point 8 | 14 | Administration of justice |

Base rules (always loaded): 19 rules covering Art. 5 prohibited practices, GDPR Art. 9 special categories, Art. 86 right to explanation, Art. 27 FRIA, Art. 4 AI literacy.

## Configuring Domains

```yaml
analysis:
  domains:
    - hr
    - finance
```

Or via env: `AULITE_DOMAINS=hr,finance`

Multiple domains can be active simultaneously. Rules are merged — a request is checked against all active domain rules plus base rules.

## List Available Domains

```bash
aulite domains
```

Output shows each domain with its description and rule count.

## How Rules Work

Each rule consists of:
- **Pattern** — regex matched against request and response text
- **Score** — 0-10 severity (10 = prohibited practice, 3 = minor indicator)
- **Category** — classification (e.g., `discrimination_age`, `proxy_race`, `prohibited_emotion`)
- **Article reference** — specific EU law article (e.g., `Dir. 2000/78/EC`, `AI Act Art. 5(1)(f)`)

Context-aware matching: common English words like `single`, `blind`, `competitive` only trigger when HR-context words (`candidate`, `applicant`, `hire`, etc.) appear within 100 characters.

## Adding Custom Rules

Create a new directory under the rules path:

```
src/rules/my-domain/
├── rules.yml       # keyword rules
└── prompt.txt      # LLM Judge context (optional)
```

Rule format in `rules.yml`:
```yaml
- pattern: "\\byour\\s*regex\\s*here\\b"
  score: 7
  category: "your_category"
  articleRef: "Relevant Article Reference"
```

Then add the domain to your config:
```yaml
analysis:
  domains:
    - hr
    - my-domain
```

No code changes needed.
