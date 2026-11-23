---
title: "Sharing the ASUS GX10 GPU with MicroK8s"
description: "Configure MicroK8s and the NVIDIA GPU Operator on an ASUS Ascent GX10, with GPU time-slicing and explicit limits on shared-memory isolation."
published: 2026-03-06
revised: 2026-10-25
tags: [homelab, infrastructure, containers, gpu, kubernetes]
image: 9a726554281280ac5ab6fdb781266a32c9554d9a-1200x630.png
image_alt: "Sharing the ASUS GX10 GPU with MicroK8s. An engineering note by Adithya Rajendran."
takeaways:
  - "MicroK8s uses its own containerd image store. Import local images or use a registry, and ensure the image supports the GX10's Arm architecture."
  - "GPU time-slicing advertises scheduling slots on one GPU. It does not give workloads separate GPU memory or fault isolation."
  - "The commands retain the versions from the original notes. The October documentation review was not a fresh test of the complete stack."
changelog:
  - date: 2026-10-25
    kind: correction
    note: "Corrected the hardware name to ASUS Ascent GX10, documented version limits and Arm64 image availability, and clarified time-slicing and the Docker-only scope of the separate memory guard."
next: dgx-spark-unified-memory-oom-hardening
next_reason: "Explore what happened when model loads exhausted host headroom. The guard described there targets Docker workloads and does not protect these Kubernetes pods."
projects: [homelab]
---
I added an ASUS Ascent GX10, based on NVIDIA GB10, to my lab to explore GPU workloads as infrastructure. It shares the GB10 platform with NVIDIA’s DGX Spark but is a distinct ASUS system. My field engineering work involved OpenStack, Kubernetes, and Ceph, so I wanted a node where several experiments could share the GPU.

This post covers how I set up MicroK8s alongside Docker, installed the NVIDIA GPU Operator, and configured GPU time-slicing so several workloads can share the GB10 GPU. Along the way, I’ll explain the MicroK8s-specific containerd paths that make this setup work.

## Version and validation scope

The commands retain MicroK8s `1.32/stable` and GPU Operator `v25.10.1` from the original March 2026 notes. The host-driver version and original test date were not recorded. This October revision checks the documentation and image manifest; it does not retest the full stack or identify these pins as the latest supported combination.

## Installing MicroK8s

```bash
sudo snap install microk8s --classic --channel=1.32/stable
sudo microk8s status --wait-ready
```

Add your user to the microk8s group:

```bash
sudo usermod -aG microk8s $USER
newgrp microk8s
microk8s kubectl get nodes
```

Enable the core add-ons:

```bash
microk8s enable dns
microk8s enable hostpath-storage
microk8s enable helm3
```

Create aliases for `kubectl` and `helm` so you do not have to prefix every command with `microk8s`:

```bash
echo "alias kubectl='microk8s kubectl'" >> ~/.bashrc
echo "alias helm='microk8s helm3'" >> ~/.bashrc
source ~/.bashrc
```

## Docker and MicroK8s Use Separate Image Stores

Docker and MicroK8s use separate container runtimes, so an image pulled with `docker pull` is not automatically available to a Kubernetes pod, and vice versa. To use a locally built Docker image in MicroK8s, import it:

```bash
docker tag myimage:latest myimage:local
docker save myimage:local | microk8s ctr images import -
```

In the pod specification, use `image: myimage:local` and `imagePullPolicy: Never` to run the imported image without contacting a registry. The image must support the GX10’s Arm architecture. On a multi-node cluster, import it on every node where the pod could run, or publish it to a registry instead. Docker and MicroK8s can each pull registry-hosted images independently.

## Installing the NVIDIA GPU Operator

The GPU Operator manages the components that expose NVIDIA GPUs to Kubernetes workloads. In this setup the host’s NVIDIA driver is already installed and managed outside Kubernetes, so I disable the operator’s driver component and let it configure the runtime and device plugin.

### Add the NVIDIA Helm Repository

```bash
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo update nvidia
helm repo list | grep nvidia
```

### Install the GPU Operator

The key flag is `--set driver.enabled=false`. The host already has a driver, so I leave that component disabled. The operator still manages the container toolkit and the other enabled components. Verify this assumption on your own host before using the command.

Because MicroK8s is packaged as a snap, its containerd socket and configuration files live under `/var/snap/microk8s/` rather than the usual system paths. The GPU Operator needs those exact locations, so I pass three environment variables explicitly:

```bash
helm install gpu-operator -n gpu-operator --create-namespace \
  nvidia/gpu-operator \
  --version=v25.10.1 \
  --set driver.enabled=false \
  --set toolkit.enabled=true \
  --set toolkit.env[0].name=CONTAINERD_CONFIG \
  --set toolkit.env[0].value=/var/snap/microk8s/current/args/containerd-template.toml \
  --set toolkit.env[1].name=CONTAINERD_SOCKET \
  --set toolkit.env[1].value=/var/snap/microk8s/common/run/containerd.sock \
  --set toolkit.env[2].name=RUNTIME_CONFIG_SOURCE \
  --set-string toolkit.env[2].value=file=/var/snap/microk8s/current/args/containerd.toml
```

These paths are a common failure point when deploying the GPU Operator on snap-based Kubernetes. If the operator cannot reach containerd, its pods may enter `CrashLoopBackOff` with a socket error. Canonical Kubernetes uses different containerd locations that depend on its configured base directory, so verify the actual socket and configuration paths before adapting this command.

### Verify GPU Access

Create a test pod using NVIDIA’s CUDA vector-add sample. As of October 25, 2026, this tag’s registry manifest contains both `linux/arm64` and `linux/amd64` images. That confirms architecture availability, not a fresh execution test on GB10; check the pod events and logs on the actual host.

```yaml
# cuda-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: cuda-vectoradd
spec:
  restartPolicy: OnFailure
  runtimeClassName: nvidia
  containers:
  - name: cuda-vectoradd
    image: "nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0-ubuntu22.04"
    resources:
      limits:
        nvidia.com/gpu: 1
```

```bash
kubectl apply -f cuda-test.yaml
kubectl logs cuda-vectoradd
```

NVIDIA’s documented successful sample output looks like this; it is an example, not a new test log from this revision:

```text
[Vector addition of 50000 elements]
Copy input data from the host memory to the CUDA device
CUDA kernel launch with 196 blocks of 256 threads
Copy output data from the CUDA device to the host memory
Test PASSED
Done
```

```bash
# Clean up
kubectl delete -f cuda-test.yaml
```

## GPU Time-Slicing: Running Multiple Workloads on One GPU

By default, Kubernetes advertises each GPU as an indivisible resource, so a node with one GPU can satisfy only one request for `nvidia.com/gpu: 1` at a time. That default can be restrictive on the GX10, which has 128 GB of coherent unified system memory. Workloads such as Jupyter notebooks, inference services, and training jobs can often coexist.

GPU time-slicing lets the NVIDIA device plugin advertise one physical GPU as several allocatable replicas and interleave workloads that share it. Unlike MIG, time-slicing provides no memory or fault isolation between replicas, so workloads share the same unified memory budget. Plan capacity accordingly.

### Step 1: Create the Time-Slicing ConfigMap

```bash
cat <<'EOF' | kubectl apply -n gpu-operator -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: time-slicing-config
data:
  any: |-
    version: v1
    flags:
      migStrategy: none
    sharing:
      timeSlicing:
        resources:
        - name: nvidia.com/gpu
          replicas: 4
EOF
```

`replicas: 4` advertises four scheduling slots backed by the same physical GPU. It does not create four GPUs, reserve four equal memory partitions, or guarantee four workloads will fit.

### Step 2: Patch the ClusterPolicy

```bash
kubectl patch clusterpolicy/cluster-policy -n gpu-operator --type merge -p \
  '{"spec":{"devicePlugin":{"config":{"name":"time-slicing-config","default":"any"}}}}'
```

### Step 3: Restart the Device Plugin

```bash
kubectl delete pod -n gpu-operator -l app=nvidia-device-plugin-daemonset
```

### Step 4: Verify

Wait 30–60 seconds, then:

```bash
kubectl describe node | grep nvidia.com/gpu
```

Expected output:

```text
nvidia.com/gpu.replicas=4
nvidia.com/gpu.sharing-strategy=time-slicing
nvidia.com/gpu.product=NVIDIA-GB10-SHARED
nvidia.com/gpu:     4
nvidia.com/gpu:     4
```

The `-SHARED` product suffix, `nvidia.com/gpu.replicas=4` label, and `sharing-strategy=time-slicing` label confirm that time-slicing is active. Each pod still requests `nvidia.com/gpu: 1`; the NVIDIA device plugin manages shared access to the physical GPU.

### Adjusting or Disabling Time-Slicing

```bash
# Change the replica count
kubectl edit configmap time-slicing-config -n gpu-operator
kubectl delete pod -n gpu-operator -l app=nvidia-device-plugin-daemonset

# Revert to exclusive access
kubectl patch clusterpolicy/cluster-policy -n gpu-operator --type merge -p \
  '{"spec":{"devicePlugin":{"config":{"name":"","default":""}}}}'
kubectl delete configmap time-slicing-config -n gpu-operator
kubectl delete pod -n gpu-operator -l app=nvidia-device-plugin-daemonset
```

With this setup, the GX10 can host several GPU experiments through MicroK8s. The GPU Operator handles integration, while time-slicing shares execution on one GPU without memory or fault isolation.

## Memory pressure still belongs to the host

Time-sliced workloads share the GB10 memory pool. My [memory-pressure investigation](/blog/dgx-spark-unified-memory-oom-hardening/) explains why a model load can also affect SSH and other host services. Its guard scans Docker cgroups; it does not monitor or stop MicroK8s/containerd pods. Do not treat it as protection for this Kubernetes setup.

References: [NVIDIA GPU Operator validation example](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/getting-started.html) and the [CUDA sample image catalog](https://catalog.ngc.nvidia.com/orgs/nvidia/k8s/containers/cuda-sample). The image tag checked here is `vectoradd-cuda12.5.0-ubuntu22.04`.
