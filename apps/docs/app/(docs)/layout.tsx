import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { ExternalLink, GithubIcon } from "lucide-react";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: (
            <div className="flex items-center font-medium">
              Visual Workflow AI
            </div>
          ),
        }}
        links={[
          {
            text: "Visit Visual Workflow AI",
            url: "https://visualworkflow.app",
            icon: <ExternalLink className="h-4 w-4" />,
          },
        ]}
        sidebar={{
          defaultOpenLevel: 1,
          collapsible: true,
          footer: null,
        }}
      >
        {children}
      </DocsLayout>
    </>
  );
}
