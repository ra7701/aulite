export interface KeywordRule {
  pattern: string;
  score: number;
  category: string;
  articleRef: string;
}

export interface LoadedRulePack {
  domain: string;
  rules: KeywordRule[];
  prompt: string;
}
