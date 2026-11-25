export interface MetricsResponse {
  champion_model: string;
  accuracy: number;
  macro_f1: number;
  weighted_f1: number;
  precision: number;
  recall: number;
  roc_auc: number;
  training_time_sec: number;
  inference_time_sec: number;
  throughput_flows_per_sec: number;
  test_sample_size: number;
  per_class: Record<
    string,
    {
      precision: number;
      recall: number;
      f1_score: number;
      test_n: number;
      total_n: number;
      low_support: boolean;
      support_note: string;
    }
  >;
  confusion_matrix: number[][];
  classes: string[];
}

export interface ComparisonResponse {
  table: Array<{
    Model: string;
    Accuracy: number;
    "Macro-F1": number;
    "Weighted-F1": number;
    Precision: number;
    Recall: number;
    "ROC-AUC": number | string;
    "Training Time (s)": number;
    "Inference Time (s)": number;
  }>;
  models: Record<string, any>;
}

export interface CaseExplanation {
  predicted_class: string;
  predicted_class_idx: number;
  true_label: string;
  sample_index: number;
  top_features: Array<{
    feature: string;
    actual_value: number;
    shap_value: number;
    impact: string;
  }>;
  disclaimer: string;
}

export interface CasesResponse {
  cases: CaseExplanation[];
  global_importance: Array<{ feature: string; importance: number }>;
  shap_note: string;
}

export interface DatasetResponse {
  benchmark_name: string;
  institution: string;
  mirror: string;
  source_url: string;
  raw_files: Array<{
    name: string;
    sha256: string;
    size_mb: number;
    total_rows: number;
    threat_types: string[];
  }>;
  total_audited_flows: number;
  funnel_stages: Array<{
    stage: string;
    count: number;
    description: string;
  }>;
  svm_sampling: {
    enabled: boolean;
    sample_size: number;
    reason: string;
  };
}

export interface PredictResponse {
  source: string;
  total_records: number;
  class_counts: Record<string, number>;
  confidences: number[];
  rows: Array<Record<string, any>>;
  duration_ms: number;
  throughput_flows_per_sec: number;
}

const BASE_URL = "/api";

export async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${BASE_URL}/metrics`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch metrics`);
  return res.json();
}

export async function fetchComparison(): Promise<ComparisonResponse> {
  const res = await fetch(`${BASE_URL}/comparison`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch comparison`);
  return res.json();
}

export async function fetchCases(): Promise<CasesResponse> {
  const res = await fetch(`${BASE_URL}/cases`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch cases`);
  return res.json();
}

export async function fetchDataset(): Promise<DatasetResponse> {
  const res = await fetch(`${BASE_URL}/dataset`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch dataset`);
  return res.json();
}

export async function runPrediction(params: { demo?: boolean; file?: File }): Promise<PredictResponse> {
  let url = `${BASE_URL}/predict`;
  let options: RequestInit = { method: "POST" };

  if (params.demo) {
    url += "?demo=true";
  } else if (params.file) {
    const formData = new FormData();
    formData.append("file", params.file);
    options.body = formData;
  } else {
    throw new Error("Must specify demo=true or attach a CSV file.");
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Prediction request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
