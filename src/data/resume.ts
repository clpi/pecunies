export type ResumeSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  accent: string;
  mode: number;
};

export type ResumeExperience = {
  slug: string;
  role: string;
  company: string;
  location: string;
  period: string;
  summary: string;
  bullets: string[];
};

export type ResumeProject = {
  slug: string;
  name: string;
  period: string;
  summary: string;
  details: string[];
  link?: {
    label: string;
    href: string;
  };
};

export type ResumeSkillGroup = {
  title: string;
  items: string[];
  note?: string;
};

export type ResumeContactItem = {
  label: string;
  value: string;
  href?: string;
};

export type EducationRecord = {
  school: string;
  degree: string;
  location: string;
  period: string;
  highlights: string[];
};

export const resumeData = {
  name: "Chris Pecunies",
  role: "Software Development Engineer II at Amazon Leo",
  statement: "Software Development Engineer II at Amazon Leo, with a background in backend systems, cloud applications, and delivery workflows.",
  commandBanner: "./resume --overview",
  availability: "Based in Seattle, with a focus on backend engineering, distributed systems, cloud infrastructure, and developer tooling.",
  location: "Seattle, WA",
  summary: [
    "I’m a Software Development Engineer II at Amazon Leo, based in Seattle.",
    "Software engineer building cloud applications, distributed services, and developer tooling. Experience includes AWS application development, Go and Rust backend systems, infrastructure automation, and blockchain operations. Independent systems work spans compiler and language development and a WebAssembly runtime in Zig.",
    "My work spans backend services and APIs, infrastructure as code, CI/CD, observability, and compiler and runtime projects."
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
  ] as ResumeSignal[],
  experience: [
    {
      "slug": "amazon-leo",
      "role": "Software Development Engineer II",
      "company": "Amazon Leo",
      "location": "Seattle, WA",
      "period": "Current",
      "summary": "Software development for Amazon Leo.",
      "bullets": [
        "Develop applications and contribute to build, test, and CI/CD workflows for Amazon Leo."
      ]
    },
    {
      "slug": "hashgraph",
      "role": "DevOps Engineer",
      "company": "HashGraph",
      "location": "Remote / Seattle, WA",
      "period": "Sep 2025 - Nov 2025",
      "summary": "Blockchain infrastructure, GitOps delivery, observability, and GCP provisioning.",
      "bullets": [
        "Managed blockchain infrastructure across 8+ environments, using Argo CD and Grafana to support deployments and operational visibility.",
        "Built artifact verification and cryptographic integrity checks into deployment workflows.",
        "Provisioned GCP infrastructure with Terraform and Ansible; tuned PromQL alerts and dashboards to reduce false positives."
      ]
    },
    {
      "slug": "wiseblocks",
      "role": "Software Engineer",
      "company": "WiseBlocks LLC",
      "location": "Hybrid / Golden, CO",
      "period": "Jun 2022 - Apr 2024",
      "summary": "Go distributed database development, Rust WebAssembly integration, APIs, and cloud automation.",
      "bullets": [
        "Developed a distributed transaction database in Go and integrated a Rust WebAssembly virtual machine for smart contract execution.",
        "Designed serialized data structures and gRPC/Protocol Buffers APIs for data exchange between network nodes.",
        "Automated cloud infrastructure and delivery workflows with Ansible and Terraform, with Prometheus and Grafana for monitoring.",
        "Built Next.js interfaces for node and block visualization and a FastAPI service for delivering data to nodes."
      ]
    },
    {
      "slug": "impresys",
      "role": "AWS Consultant",
      "company": "Impresys Software Corporation",
      "location": "Seattle, WA",
      "period": "Sep 2019 - May 2022",
      "summary": "Cloud training, AWS CDK demonstrations, infrastructure automation, and workflow modernization.",
      "bullets": [
        "Developed and delivered AWS and Azure technical training on cloud architecture, infrastructure automation, and CI/CD.",
        "Collaborated with AWS engineers on AWS CDK demonstrations and automated environment provisioning.",
        "Modernized legacy production workflows with Python, Qt/QML, and OpenCV."
      ]
    },
    {
      "slug": "gemsec",
      "role": "Research Assistant",
      "company": "University of Washington",
      "location": "Seattle, WA",
      "period": "Jun 2018 - Apr 2021",
      "summary": "Scientific software, containerized web applications, data modeling, and research tooling.",
      "bullets": [
        "Built containerized web applications and REST services using AWS, React, Django, FastAPI, PostgreSQL, and Docker.",
        "Developed Python tools for scientific simulation, data modeling, and computer vision; mentored undergraduate researchers in machine learning and data analysis."
      ]
    }
  ] as ResumeExperience[],
  projects: [
    {
      "slug": "idol",
      "name": "Idol",
      "period": "Ongoing",
      "summary": "Independent compiler and language project",
      "details": [
        "Developing a programming language and compiler, with work on graph-based representations, program analysis, and code generation."
      ]
    },
    {
      "slug": "zig-runtime",
      "name": "wart — WebAssembly Runtime in Zig",
      "period": "May 2025 - Present",
      "summary": "WebAssembly runtime in Zig",
      "details": [
        "Developing a WebAssembly runtime in Zig, with work on instruction dispatch, memory layout, runtime performance, and WASI support."
      ]
    },
    {
      "slug": "moe-marketplace",
      "name": "Marketplace Aggregator on AWS",
      "period": "Apr 2026 - Present",
      "summary": "moe.pecunies.com",
      "details": [
        "Built a serverless marketplace aggregator with AWS Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, and AWS CDK.",
        "Designed retry, state-management, and idempotency mechanisms to handle external API failures, rate limits, and duplicate listing prevention."
      ],
      "link": {
        "label": "moe.pecunies.com",
        "href": "https://moe.pecunies.com"
      }
    },
    {
      "slug": "pi-cluster",
      "name": "Raspberry Pi Infrastructure Cluster",
      "period": "2024 - Present",
      "summary": "A hardware-constrained home lab for orchestration, observability, and deployment experiments.",
      "details": [
        "Runs repeatable Linux services and deployment tests on small ARM nodes to keep infrastructure work grounded in resource limits.",
        "Used for Kubernetes, GitOps, monitoring, and service-mesh experimentation outside managed cloud defaults.",
        "Acts as a practical sandbox for infrastructure patterns before applying them to cloud systems."
      ]
    },
    {
      "slug": "down-nvim",
      "name": "down.nvim",
      "period": "2026 - Present",
      "summary": "A Neovim 0.12+ plugin for markdown note-taking with planned LSP and AI-assisted workflow integration.",
      "details": [
        "Focuses on fast terminal-native markdown capture, navigation, and note organization inside Neovim.",
        "Designed with an eventual language-server layer for notes, references, backlinks, and structured markdown actions.",
        "Planned AI integration will support terminal-native note workflows without turning the editor into a heavyweight web app."
      ],
      "link": {
        "label": "github.com/clpi/down.nvim.git",
        "href": "https://github.com/clpi/down.nvim.git"
      }
    }
  ] as ResumeProject[],
  skills: [
    {
      "title": "Languages",
      "items": [
        "Rust",
        "Go",
        "Python",
        "TypeScript",
        "Zig",
        "C/C++",
        "SQL"
      ]
    },
    {
      "title": "Backend and systems",
      "items": [
        "Distributed systems",
        "WebAssembly",
        "gRPC",
        "Protocol Buffers",
        "FastAPI",
        "PostgreSQL",
        "Linux"
      ]
    },
    {
      "title": "Cloud and delivery",
      "items": [
        "AWS",
        "GCP",
        "Azure",
        "AWS CDK",
        "Terraform",
        "Ansible",
        "Docker",
        "Kubernetes",
        "CI/CD",
        "Argo CD",
        "Prometheus",
        "Grafana"
      ]
    },
    {
      "title": "Web applications",
      "items": [
        "React",
        "Next.js",
        "TypeScript",
        "Django",
        "FastAPI",
        "REST APIs"
      ]
    }
  ] as ResumeSkillGroup[],
  contact: [
    {
      "label": "Email",
      "value": "chris@pecunies.com",
      "href": "mailto:chris@pecunies.com"
    },
    {
      "label": "LinkedIn",
      "value": "linkedin.com/in/chrispecunies",
      "href": "https://linkedin.com/in/chrispecunies"
    },
    {
      "label": "GitHub",
      "value": "github.com/clpi",
      "href": "https://github.com/clpi"
    },
    {
      "label": "GitLab",
      "value": "gitlab.com/clpi",
      "href": "https://gitlab.com/clpi"
    },
    {
      "label": "Website",
      "value": "pecunies.com",
      "href": "https://pecunies.com"
    },
    {
      "label": "Location",
      "value": "Seattle, WA"
    }
  ] as ResumeContactItem[],
  education: {
    "school": "University of Washington",
    "degree": "B.S. Materials Science & Engineering",
    "location": "Seattle, WA",
    "period": "August 2015 - June 2019",
    "highlights": [
      "Relevant coursework: database systems, data structures and algorithms, artificial intelligence, and machine learning.",
      "Graduated with degree focus in Nanotechnology & Molecular Engineering.",
      "Dean’s List academic honors recognized twice."
    ]
  } as EducationRecord,
  pdf: {
    "href": "/chris-pecunies-resume.pdf",
    "markdownHref": "/chris-pecunies-resume.md",
    "previews": [
      {
        "label": "Page 1",
        "image": "/resume-page-1.png",
        "href": "/chris-pecunies-resume.pdf#page=1"
      },
      {
        "label": "Page 2",
        "image": "/resume-page-2.png",
        "href": "/chris-pecunies-resume.pdf#page=2"
      }
    ]
  },
} as const;

export type ResumeData = typeof resumeData;
