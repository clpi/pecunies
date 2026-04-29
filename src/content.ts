export type WorkItem = {
  id: string;
  index: string;
  title: string;
  category: string;
  period: string;
  summary: string;
  impact: string;
  details: string[];
  stack: string[];
  accent: string;
  mode: number;
  href?: string;
  linkLabel: string;
};

export type SignalItem = {
  id: string;
  value: string;
  label: string;
  detail: string;
  accent: string;
  mode: number;
};

export type CapabilityItem = {
  id: string;
  label: string;
  detail: string;
  tools: string[];
  strength: number;
  accent: string;
  mode: number;
};

export type TraceItem = {
  role: string;
  org: string;
  period: string;
  location: string;
  detail: string;
};

export const siteContent = {
  brand: 'CHRIS PECUNIES',
  person: {
    name: 'Chris Pecunies',
    role: 'Cloud infrastructure / distributed systems / interface engineering',
    statement: 'I build cloud-heavy systems, delivery pipelines, and minimal interfaces that stay sharp under real load.',
    intro:
      'Software engineer with 4+ years across AWS, Azure, GCP, and OCI, working from DevOps automation and blockchain infrastructure to Rust/WASM runtimes and front-end delivery.',
    availability:
      'Available for platform engineering, cloud architecture, CI/CD automation, full-stack systems, and performance-sensitive web products.',
  },
  manifest: [
    'AWS',
    'Azure',
    'GCP',
    'OCI',
    'Rust',
    'Go',
    'TypeScript',
    'Python',
    'WebAssembly',
    'Terraform',
    'Ansible',
    'GitHub Actions',
  ],
  signals: [
    {
      id: 'cloud',
      value: '4+ years',
      label: 'Cloud systems',
      detail: 'Built and operated systems across AWS, Azure, GCP, and OCI, from application layers through infrastructure and delivery.',
      accent: '#e7ff58',
      mode: 0,
    },
    {
      id: 'uptime',
      value: '99.9%',
      label: 'Uptime target',
      detail: 'Engineered cloud network architecture and CI/CD-backed testing and deployment surfaces at WiseBlocks with 99.9% uptime expectations.',
      accent: '#ffffff',
      mode: 1,
    },
    {
      id: 'environments',
      value: '8+ envs',
      label: 'Chain operations',
      detail: 'Helped manage and harden multi-tier blockchain infrastructure across eight-plus environments with GitOps controls and better observability.',
      accent: '#9dd6ff',
      mode: 2,
    },
    {
      id: 'wasm',
      value: 'Rust + Zig',
      label: 'Runtime work',
      detail: 'Shipped Rust/WASM systems in production work and continue building a performance-targeted WebAssembly runtime in Zig.',
      accent: '#f3efe8',
      mode: 1,
    },
  ] as SignalItem[],
  work: [
    {
      id: 'wiseblocks-runtime',
      index: '01',
      title: 'Distributed Transaction Runtime',
      category: 'WiseBlocks LLC',
      period: '2022 - 2024',
      summary:
        'Developed a distributed transaction database in Go and integrated a Rust-based WebAssembly VM for low-latency execution of financial smart contracts.',
      impact:
        'Combined runtime work, cloud architecture, and interface delivery into one platform, with Prometheus and Grafana-backed deployment flows targeting 99.9% uptime.',
      details: [
        'Built serialized data structures and gRPC APIs with Protocol Buffers to reduce network overhead.',
        'Delivered a Next.js front end and FastAPI services for real-time node and block visibility.',
        'Contributed to fault tolerance, consensus-facing architecture, and transaction finality design.',
      ],
      stack: ['Go', 'Rust', 'WebAssembly', 'Next.js', 'FastAPI', 'gRPC'],
      accent: '#e7ff58',
      mode: 0,
      href: 'https://github.com/clpi',
      linkLabel: 'GitHub profile',
    },
    {
      id: 'hashgraph-ops',
      index: '02',
      title: 'Multi-Environment Chain Ops',
      category: 'HashGraph',
      period: '2025',
      summary:
        'Managed multi-tier blockchain infrastructure across 8+ environments with GitOps deployment controls, Grafana observability, and GCP provisioning.',
      impact:
        'Strengthened security and auditability with manifest integrity checks, artifact verification, and cleaner production alerting for on-call engineers.',
      details: [
        'Applied ArgoCD-driven GitOps practices across multi-tier deployment paths.',
        'Used Terraform modules and Ansible playbooks with Vault for node lifecycle management.',
        'Reduced false-positive alerts by investigating production telemetry and tuning PromQL dashboards.',
      ],
      stack: ['Terraform', 'ArgoCD', 'Grafana', 'PromQL', 'GCP', 'Ansible'],
      accent: '#9dd6ff',
      mode: 2,
      href: undefined,
      linkLabel: 'Available on request',
    },
    {
      id: 'consulting-delivery',
      index: '03',
      title: 'Cloud Delivery Automation',
      category: 'Independent Consultant',
      period: '2024 - present',
      summary:
        'Delivering infrastructure automation for startup and personal projects with Terraform, Ansible, Kubernetes, and CI/CD systems built around GitHub Actions and Jenkins.',
      impact:
        'Reduced manual infrastructure work and improved operational visibility through repeatable delivery pipelines and custom Grafana and Prometheus dashboards.',
      details: [
        'Maintained infrastructure with Terraform, CloudFormation, AWS CDK, and related tooling.',
        'Built CI/CD systems for cloud-native applications with GitHub Actions and Jenkins.',
        'Designed tailored monitoring views with Grafana, Prometheus, and PromQL.',
      ],
      stack: ['Terraform', 'Kubernetes', 'GitHub Actions', 'Jenkins', 'Grafana', 'Prometheus'],
      accent: '#f3efe8',
      mode: 1,
      href: undefined,
      linkLabel: 'Selected work available on request',
    },
    {
      id: 'zig-runtime',
      index: '04',
      title: 'WebAssembly Runtime in Zig',
      category: 'Independent project',
      period: '2025 - present',
      summary:
        'Building a performance-targeted WebAssembly runtime in Zig with careful attention to memory layout, instruction dispatch, and WASM 3.0 plus WASI preview support.',
      impact:
        'This project sharpens the systems side of the portfolio: low-level runtime design, benchmarking discipline, and aggressive execution-path optimization.',
      details: [
        'Focused on runtime throughput and memory behavior rather than wrapper tooling.',
        'Targets modern WASM and WASI compatibility while still pushing benchmark performance.',
        'Source can be shared selectively on request.',
      ],
      stack: ['Zig', 'WASM', 'WASI', 'Benchmarks', 'Runtime design'],
      accent: '#ffffff',
      mode: 1,
      href: '/chris-pecunies-resume.pdf',
      linkLabel: 'Resume PDF',
    },
  ] as WorkItem[],
  experience: [
    {
      role: 'Independent Cloud DevOps Consultant',
      org: 'Freelance',
      period: 'May 2024 - present',
      location: 'Seattle, WA',
      detail: 'Infrastructure automation, CI/CD pipelines, monitoring, and cloud-native delivery.',
    },
    {
      role: 'DevOps Engineer',
      org: 'HashGraph',
      period: 'Sep 2025 - Nov 2025',
      location: 'Remote',
      detail: 'GitOps, blockchain infrastructure, Grafana observability, and GCP provisioning.',
    },
    {
      role: 'Software Engineer',
      org: 'WiseBlocks LLC',
      period: 'Jun 2022 - Apr 2024',
      location: 'Golden, CO',
      detail: 'Go database work, Rust/WASM VM integration, APIs, and front-end delivery.',
    },
    {
      role: 'AWS Consultant',
      org: 'Impresys Software Corporation',
      period: 'Sep 2019 - May 2022',
      location: 'Seattle, WA',
      detail: 'Cloud training material, AWS CDK rollout support, DevOps procedures, and automation.',
    },
    {
      role: 'Research Assistant',
      org: 'GEMSEC, University of Washington',
      period: 'Jun 2018 - Apr 2021',
      location: 'Seattle, WA',
      detail: 'Containerized research apps, REST APIs, data modeling, and scientific computing with Python.',
    },
  ] as TraceItem[],
  capabilities: [
    {
      id: 'cloud-platforms',
      label: 'Cloud platforms',
      detail: 'Comfortable across AWS, Azure, GCP, and OCI, with delivery systems shaped through Terraform, Ansible, containers, and infrastructure orchestration.',
      tools: ['AWS', 'Azure', 'GCP', 'OCI', 'Terraform', 'Ansible'],
      strength: 95,
      accent: '#e7ff58',
      mode: 0,
    },
    {
      id: 'runtime-systems',
      label: 'Runtime and distributed systems',
      detail: 'Go, Rust, gRPC, Protocol Buffers, consensus-aware architecture, and lower-level runtime work in WebAssembly and Zig.',
      tools: ['Go', 'Rust', 'gRPC', 'Protocol Buffers', 'WASM', 'Zig'],
      strength: 89,
      accent: '#9dd6ff',
      mode: 2,
    },
    {
      id: 'product-surfaces',
      label: 'Product and API surfaces',
      detail: 'Front-end and API work that stays tightly coupled to the system underneath it, including Next.js, React, FastAPI, Django, and operational UX.',
      tools: ['React', 'Next.js', 'TypeScript', 'FastAPI', 'Django', 'Node.js'],
      strength: 86,
      accent: '#ffffff',
      mode: 1,
    },
    {
      id: 'delivery-observability',
      label: 'Delivery and observability',
      detail: 'CI/CD pipelines, Prometheus, Grafana, GitHub Actions, Jenkins, Kubernetes, and the unglamorous reliability work that keeps systems operable.',
      tools: ['GitHub Actions', 'Jenkins', 'Prometheus', 'Grafana', 'Kubernetes', 'Docker'],
      strength: 91,
      accent: '#f3efe8',
      mode: 1,
    },
  ] as CapabilityItem[],
  contact: {
    heading: "Let's build the hard part cleanly.",
    copy:
      'Based in Seattle. Available for cloud platforms, distributed systems, delivery automation, and selective full-stack work where infrastructure and product need to meet cleanly.',
    email: 'chris@pecunies.com',
    location: 'Seattle, WA',
    links: [
      { label: 'GitHub', href: 'https://github.com/clpi' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/chrispecunies' },
      { label: 'Resume PDF', href: '/chris-pecunies-resume.pdf' },
    ],
  },
  footer: 'Chris Pecunies · cloud systems · Rust/WASM · Cloudflare',
};
