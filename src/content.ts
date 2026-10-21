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
  brand: "CHRIS PECUNIES",
  person: {
    "name": "Chris Pecunies",
    "role": "Software Development Engineer II at Amazon Leo",
    "statement": "I build backend services, distributed systems, and cloud delivery workflows.",
    "intro": "Based in Seattle. My experience spans Go and Rust backend systems, Python APIs, cloud infrastructure, CI/CD, and WebAssembly. Alongside my professional work, I develop Idol and wart.",
    "availability": "Based in Seattle, with a focus on backend engineering, distributed systems, cloud infrastructure, and developer tooling."
  },
  manifest: [
    "AWS",
    "Azure",
    "GCP",
    "OCI",
    "Rust",
    "Go",
    "TypeScript",
    "Python",
    "WebAssembly",
    "Terraform",
    "Ansible",
    "GitHub Actions"
  ],
  signals: [
    {
      "id": "current-role",
      "label": "Current role",
      "value": "SDE II",
      "detail": "Software Development Engineer II at Amazon Leo in Seattle.",
      "accent": "#e7ff58",
      "mode": 0
    },
    {
      "id": "backend-systems",
      "label": "Backend systems",
      "value": "Go + Rust",
      "detail": "Distributed databases, service APIs, gRPC, and WebAssembly integration.",
      "accent": "#9dd6ff",
      "mode": 2
    },
    {
      "id": "cloud-delivery",
      "label": "Cloud delivery",
      "value": "AWS + GCP",
      "detail": "Cloud infrastructure, repeatable builds, CI/CD, and observability.",
      "accent": "#ffffff",
      "mode": 1
    },
    {
      "id": "systems-projects",
      "label": "Systems projects",
      "value": "Zig + WASM",
      "detail": "Ongoing wart runtime work and the Idol language and compiler project.",
      "accent": "#f3efe8",
      "mode": 1
    }
  ] as SignalItem[],
  work: [
    {
      "id": "wiseblocks-runtime",
      "index": "01",
      "title": "Distributed Transaction Runtime",
      "category": "WiseBlocks LLC",
      "period": "2022 - 2024",
      "summary": "Developed a distributed transaction database in Go and integrated a Rust-based WebAssembly VM for low-latency execution of financial smart contracts.",
      "impact": "Combined Go and Rust runtime work with cloud automation, service APIs, and Prometheus and Grafana monitoring.",
      "details": [
        "Built serialized data structures and gRPC APIs with Protocol Buffers to reduce network overhead.",
        "Delivered a Next.js front end and FastAPI services for real-time node and block visibility.",
        "Contributed to fault tolerance, consensus-facing architecture, and transaction finality design."
      ],
      "stack": [
        "Go",
        "Rust",
        "WebAssembly",
        "Next.js",
        "FastAPI",
        "gRPC"
      ],
      "accent": "#e7ff58",
      "mode": 0,
      "href": "https://github.com/clpi",
      "linkLabel": "GitHub profile"
    },
    {
      "id": "idol",
      "index": "02",
      "title": "Idol Language and Compiler",
      "category": "Independent project",
      "period": "Ongoing",
      "summary": "Developing a programming language and compiler with graph-based representations, program analysis, and code generation.",
      "impact": "An ongoing systems project exploring language design and compiler architecture.",
      "details": [
        "Work centers on graph intermediate representations, analysis, and code generation.",
        "The repository is private; this description summarizes the project’s current focus."
      ],
      "stack": [
        "Compiler design",
        "Graph IR",
        "Program analysis",
        "Code generation"
      ],
      "accent": "#f3efe8",
      "mode": 1,
      "linkLabel": "Private independent project"
    },
    {
      "id": "zig-runtime",
      "index": "03",
      "title": "wart — WebAssembly Runtime in Zig",
      "category": "Independent project",
      "period": "2025 - present",
      "summary": "Developing a WebAssembly runtime in Zig, with work on instruction dispatch, memory layout, runtime performance, and WASI support.",
      "impact": "An ongoing independent project exploring runtime architecture and execution behavior.",
      "details": [
        "Work includes WebAssembly execution, memory behavior, and runtime implementation.",
        "The repository is private; this description summarizes the project’s current focus."
      ],
      "stack": [
        "Zig",
        "WASM",
        "WASI",
        "Benchmarks",
        "Runtime design"
      ],
      "accent": "#ffffff",
      "mode": 1,
      "linkLabel": "Private independent project"
    },
    {
      "id": "hashgraph-ops",
      "index": "04",
      "title": "Multi-Environment Chain Ops",
      "category": "HashGraph",
      "period": "2025",
      "summary": "Managed multi-tier blockchain infrastructure across 8+ environments with GitOps deployment controls, Grafana observability, and GCP provisioning.",
      "impact": "Strengthened security and auditability with manifest integrity checks, artifact verification, and cleaner production alerting for on-call engineers.",
      "details": [
        "Applied ArgoCD-driven GitOps practices across multi-tier deployment paths.",
        "Used Terraform modules and Ansible playbooks with Vault for node lifecycle management.",
        "Reduced false-positive alerts by investigating production telemetry and tuning PromQL dashboards."
      ],
      "stack": [
        "Terraform",
        "ArgoCD",
        "Grafana",
        "PromQL",
        "GCP",
        "Ansible"
      ],
      "accent": "#9dd6ff",
      "mode": 2,
      "linkLabel": "Available on request"
    }
  ] as WorkItem[],
  experience: [
    {
      "role": "Software Development Engineer II",
      "org": "Amazon Leo",
      "period": "Current",
      "location": "Seattle, WA",
      "detail": "Software development for Amazon Leo."
    },
    {
      "role": "DevOps Engineer",
      "org": "HashGraph",
      "period": "Sep 2025 - Nov 2025",
      "location": "Remote / Seattle, WA",
      "detail": "Blockchain infrastructure, GitOps delivery, observability, and GCP provisioning."
    },
    {
      "role": "Software Engineer",
      "org": "WiseBlocks LLC",
      "period": "Jun 2022 - Apr 2024",
      "location": "Hybrid / Golden, CO",
      "detail": "Go distributed database development, Rust WebAssembly integration, APIs, and cloud automation."
    },
    {
      "role": "AWS Consultant",
      "org": "Impresys Software Corporation",
      "period": "Sep 2019 - May 2022",
      "location": "Seattle, WA",
      "detail": "Cloud training, AWS CDK demonstrations, infrastructure automation, and workflow modernization."
    },
    {
      "role": "Research Assistant",
      "org": "University of Washington",
      "period": "Jun 2018 - Apr 2021",
      "location": "Seattle, WA",
      "detail": "Scientific software, containerized web applications, data modeling, and research tooling."
    }
  ] as TraceItem[],
  capabilities: [
    {
      "id": "cloud-platforms",
      "label": "Cloud platforms",
      "detail": "Comfortable across AWS, Azure, GCP, and OCI, with delivery systems shaped through Terraform, Ansible, containers, and infrastructure orchestration.",
      "tools": [
        "AWS",
        "Azure",
        "GCP",
        "OCI",
        "Terraform",
        "Ansible"
      ],
      "strength": 95,
      "accent": "#e7ff58",
      "mode": 0
    },
    {
      "id": "runtime-systems",
      "label": "Runtime and distributed systems",
      "detail": "Go, Rust, gRPC, Protocol Buffers, consensus-aware architecture, and lower-level runtime work in WebAssembly and Zig.",
      "tools": [
        "Go",
        "Rust",
        "gRPC",
        "Protocol Buffers",
        "WASM",
        "Zig"
      ],
      "strength": 89,
      "accent": "#9dd6ff",
      "mode": 2
    },
    {
      "id": "product-surfaces",
      "label": "Product and API surfaces",
      "detail": "Front-end and API work that stays tightly coupled to the system underneath it, including Next.js, React, FastAPI, Django, and operational UX.",
      "tools": [
        "React",
        "Next.js",
        "TypeScript",
        "FastAPI",
        "Django",
        "Node.js"
      ],
      "strength": 86,
      "accent": "#ffffff",
      "mode": 1
    },
    {
      "id": "delivery-observability",
      "label": "Delivery and observability",
      "detail": "CI/CD pipelines, Prometheus, Grafana, GitHub Actions, Jenkins, Kubernetes, and the unglamorous reliability work that keeps systems operable.",
      "tools": [
        "GitHub Actions",
        "Jenkins",
        "Prometheus",
        "Grafana",
        "Kubernetes",
        "Docker"
      ],
      "strength": 91,
      "accent": "#f3efe8",
      "mode": 1
    }
  ] as CapabilityItem[],
  contact: {
    "heading": "Let’s talk systems.",
    "copy": "Software Development Engineer II at Amazon Leo, based in Seattle. My work spans backend engineering, distributed systems, cloud infrastructure, and developer tooling.",
    "email": "chris@pecunies.com",
    "location": "Seattle, WA",
    "links": [
      {
        "label": "GitHub",
        "href": "https://github.com/clpi"
      },
      {
        "label": "LinkedIn",
        "href": "https://www.linkedin.com/in/chrispecunies"
      },
      {
        "label": "Resume PDF",
        "href": "/chris-pecunies-resume.pdf"
      }
    ]
  },
  footer: "Chris Pecunies · backend engineering · distributed systems · cloud infrastructure",
};
