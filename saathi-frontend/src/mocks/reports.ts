export type Metric = {
  name: string;
  value: string;
  unit: string;
  status: "ok" | "borderline" | "high" | "low";
};

export type Report = {
  id: string;
  filename: string;
  kind: string;
  date: string;
  status: "ok" | "processing" | "error";
  errorMessage?: string;
  metrics: Metric[];
};

// TODO: fetch from /api/reports
export const mockReports: Report[] = [
  {
    id: "r1",
    filename: "CBC_priya_mar2026.pdf",
    kind: "CBC",
    date: "12 Mar 2026",
    status: "ok",
    metrics: [
      { name: "Hemoglobin", value: "13.4", unit: "g/dL", status: "ok" },
      { name: "WBC", value: "7.1", unit: "x10³/µL", status: "ok" },
      { name: "Platelets", value: "245", unit: "x10³/µL", status: "ok" },
      { name: "RBC", value: "4.6", unit: "x10⁶/µL", status: "ok" },
      { name: "MCV", value: "88", unit: "fL", status: "ok" },
      { name: "MCH", value: "29", unit: "pg", status: "ok" },
      { name: "MCHC", value: "33", unit: "g/dL", status: "ok" },
    ],
  },
  {
    id: "r2",
    filename: "Lipid_panel_feb.pdf",
    kind: "Lipid panel",
    date: "28 Feb 2026",
    status: "ok",
    metrics: [
      { name: "Total cholesterol", value: "196", unit: "mg/dL", status: "ok" },
      { name: "LDL", value: "128", unit: "mg/dL", status: "borderline" },
      { name: "HDL", value: "48", unit: "mg/dL", status: "ok" },
      { name: "Triglycerides", value: "142", unit: "mg/dL", status: "ok" },
    ],
  },
  {
    id: "r3",
    filename: "Thyroid_tsh.jpg",
    kind: "Thyroid (TSH)",
    date: "14 Feb 2026",
    status: "processing",
    metrics: [],
  },
  {
    id: "r4",
    filename: "scan_handwritten.jpg",
    kind: "Handwritten report",
    date: "02 Feb 2026",
    status: "error",
    errorMessage: "Couldn't read — handwritten reports aren't supported yet.",
    metrics: [],
  },
];
