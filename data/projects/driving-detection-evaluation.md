---
title: "Evaluating detectors on driving scenes"
name: "Driving detection study"
summary: "Changing one post-processing setting raised YOLO26m KITTI AP from 26.20 to 27.80 and reversed its comparison with the NMS-free head. A CMPE 249 study of evaluation settings, domain shift, and inference latency."
order: 5
status: completed
status_note: "Completed CMPE 249 course study, October 2026."
types: [research, software]
technologies: ["Python", "PyTorch", "Ultralytics", "pycocotools", "TensorRT", "Jetson Orin Nano"]
role: "Evaluation harness, experiments, and analysis"
started: 2026-01-01
ended: 2026-01-01
date_precision: year
dates_approximate: false
featured: 1
cover: 24224f397bb32cf609f4c2a7b4520d12ec46eb3c-2160x1440.png
cover_alt: "Multi-label NMS improves AP by 1.60 points over single-label NMS and 0.90 over the NMS-free head, with paired 95% bootstrap intervals."
cover_caption: "YOLO26m, KITTI validation, 640 px, four classes. Paired 95% bootstrap intervals, 300 image-level resamples."
problem: "How much of a detector’s apparent advantage comes from the evaluation protocol?"
approach: "I built a common evaluator with dataset mappings and ignored-region handling, then compared predictions on the same images and measured inference latency on a Jetson Orin Nano."
outcome: "On KITTI at 640 px, multi-label NMS raised AP by 1.60 points and reversed a head-to-head comparison."
highlights:
  - "Built an evaluation harness with dataset mappings, ignored-region handling, paired bootstrap comparisons, and recorded run configurations."
  - "Found that multi-label NMS raises YOLO26m KITTI AP by 1.60 points at 640 px and reverses its AP comparison with the NMS-free head."
  - "Compared transfer across driving datasets and accuracy/latency trade-offs on an 8 GB Jetson Orin Nano."
parameters:
  - label: "KITTI validation frames"
    value: "3,769"
  - label: "nuImages sample"
    value: "3,000 frames"
  - label: "Inference hardware"
    value: "Jetson Orin Nano 8 GB"
results:
  - metric: "Multi-label vs single-label NMS"
    value: "+1.60 AP points"
    note: "YOLO26m, KITTI val, 640 px, four mapped classes; paired bootstrap 95% CI +1.29 to +1.93, 300 resamples."
  - metric: "Multi-label NMS vs NMS-free"
    value: "+0.90 AP points"
    note: "Same KITTI protocol; paired bootstrap 95% CI +0.57 to +1.15, 300 resamples. Speed is evaluated separately."
links:
  - label: "Read report (PDF)"
    kind: paper
    file: "fc41d42d9b66390887e20ff239a1361e55975238.pdf"
  - label: "Evaluation code and artifacts"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/HW1-2D-Detection"
---
## What I changed

The single-label predictor keeps only one class for each box. Enabling multi-label NMS changed the KITTI result enough to reverse the AP comparison with the NMS-free head. I held the YOLO26m checkpoint and 640 px input fixed and used paired image-level resampling to estimate the difference.

The wider study examines resolution, fine-tuning, annotation gaps, and transfer from COCO to KITTI and nuImages. The contribution is the evaluation protocol and analysis; the detector and VLM architectures are existing models.

## Scope of the result

These AP differences apply to four mapped KITTI classes and this configuration. They do not establish a general architecture ranking. Fine-tuning comparisons include single runs; model size and pretraining differ between the VLM and detectors.

The PDF is the October 23 course report. Jetson results measure inference accuracy and latency. The GX10 was used for VLM training and accuracy evaluation. The repository credits the course’s ngdet tutorial and contains the separate evaluation harness.

## Evidence sources

[Report source and figures](https://github.com/Adithya-Rajendran/HW1-2D-Detection/tree/6e6a020c8556d4ca0e3de06a1d6f5de9f1ed46d6/paper)

[Paired statistical comparisons](https://github.com/Adithya-Rajendran/HW1-2D-Detection/tree/6e6a020c8556d4ca0e3de06a1d6f5de9f1ed46d6/results/paired)
