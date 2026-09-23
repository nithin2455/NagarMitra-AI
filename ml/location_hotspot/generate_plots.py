"""
CivicPulse AI Component 3 — Research Chart Visual Plot Generator
Generates publication-grade SVG chart assets for Component 3 evaluation results:
- evaluation/charts/parameter_sensitivity.svg
- evaluation/charts/master_vs_raw_comparison.svg
- evaluation/charts/scalability_benchmark.svg
"""

import os
import sys
import csv
import json

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
CHARTS_DIR = os.path.join(EVAL_DIR, "charts")
os.makedirs(CHARTS_DIR, exist_ok=True)

def generate_svg_parameter_sensitivity():
    csv_path = os.path.join(EVAL_DIR, "parameter_study.csv")
    if not os.path.exists(csv_path):
        return

    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r["min_samples"] == "5":
                rows.append(r)

    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450" style="background:#ffffff; font-family: sans-serif;">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="400" y="35" text-anchor="middle" font-size="18" font-weight="bold" fill="#0f172a">DBSCAN Parameter Sensitivity: Epsilon Radius vs Silhouette Score</text>',
        '<line x1="80" y1="370" x2="750" y2="370" stroke="#cbd5e1" stroke-width="2"/>',
        '<line x1="80" y1="70" x2="80" y2="370" stroke="#cbd5e1" stroke-width="2"/>',
    ]

    for i in range(6):
        val = 0.8 + i * 0.04
        y = 370 - (i / 5.0) * 300
        svg.append(f'<line x1="75" y1="{y}" x2="750" y2="{y}" stroke="#f1f5f9" stroke-width="1"/>')
        svg.append(f'<text x="65" y="{y+4}" text-anchor="end" font-size="12" fill="#64748b">{val:.2f}</text>')

    pts = []
    for idx, r in enumerate(rows):
        x = 120 + idx * 110
        sil = float(r["silhouette_score"])
        # Scale 0.80 to 1.00
        y = 370 - ((sil - 0.80) / 0.20) * 300
        pts.append(f"{x:.1f},{y:.1f}")
        eps_lbl = f"{float(r['eps_meters']):.0f}m"
        svg.append(f'<text x="{x}" y="390" text-anchor="middle" font-size="11" fill="#475569">{eps_lbl}</text>')

    svg.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="#2563eb" stroke-width="3"/>')
    for pt in pts:
        x, y = pt.split(",")
        svg.append(f'<circle cx="{x}" cy="{y}" r="6" fill="#2563eb"/>')

    svg.append('<text x="415" y="420" text-anchor="middle" font-size="13" font-weight="bold" fill="#334155">Geographic Cluster Radius (Eps Meters)</text>')

    with open(os.path.join(CHARTS_DIR, "parameter_sensitivity.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))
    print(f"[Chart Generator] Created {os.path.join(CHARTS_DIR, 'parameter_sensitivity.svg')}")

def generate_svg_scalability():
    csv_path = os.path.join(EVAL_DIR, "scalability_results.csv")
    if not os.path.exists(csv_path):
        return

    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450" style="background:#ffffff; font-family: sans-serif;">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="400" y="35" text-anchor="middle" font-size="18" font-weight="bold" fill="#0f172a">Component 3: DBSCAN Spatial Clustering Execution Time (ms)</text>',
        '<line x1="90" y1="370" x2="750" y2="370" stroke="#cbd5e1" stroke-width="2"/>',
        '<line x1="90" y1="70" x2="90" y2="370" stroke="#cbd5e1" stroke-width="2"/>',
    ]

    for i in range(5):
        val = i * 400
        y = 370 - (i / 4.0) * 300
        svg.append(f'<line x1="85" y1="{y}" x2="750" y2="{y}" stroke="#f1f5f9" stroke-width="1"/>')
        svg.append(f'<text x="75" y="{y+4}" text-anchor="end" font-size="12" fill="#64748b">{val}ms</text>')

    pts = []
    for idx, r in enumerate(rows):
        x = 120 + idx * 140
        t_ms = float(r["execution_time_ms"])
        y = 370 - (min(t_ms, 1600.0) / 1600.0) * 300
        pts.append(f"{x:.1f},{y:.1f}")
        size_lbl = f"{int(r['workload_size']):,}"
        svg.append(f'<text x="{x}" y="390" text-anchor="middle" font-size="11" fill="#475569">{size_lbl}</text>')
        svg.append(f'<text x="{x}" y="{y-10}" text-anchor="middle" font-size="11" font-weight="bold" fill="#0d9488">{t_ms:.1f}ms</text>')

    svg.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="#0d9488" stroke-width="3"/>')
    for pt in pts:
        x, y = pt.split(",")
        svg.append(f'<circle cx="{x}" cy="{y}" r="6" fill="#0d9488"/>')

    svg.append('<text x="420" y="420" text-anchor="middle" font-size="13" font-weight="bold" fill="#334155">Historical Database Size (Complaints)</text>')

    with open(os.path.join(CHARTS_DIR, "scalability_benchmark.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(svg))
    print(f"[Chart Generator] Created {os.path.join(CHARTS_DIR, 'scalability_benchmark.svg')}")

if __name__ == "__main__":
    generate_svg_parameter_sensitivity()
    generate_svg_scalability()
