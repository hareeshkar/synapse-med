import React, { useState } from "react";
import {
  X,
  Search,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Brain,
  AlertTriangle,
  Pill,
  Heart,
  Circle,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  Activity,
  Stethoscope,
  TestTube,
  Tag,
  Lightbulb,
  FileText,
  Microscope,
} from "lucide-react";
import { KnowledgeNode, KnowledgeGraphData } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  node: KnowledgeNode | null;
  graphData: KnowledgeGraphData;
  onClose: () => void;
  onNodeClick: (nodeId: string) => void;
}

const NodeInspector: React.FC<Props> = ({
  node,
  graphData,
  onClose,
  onNodeClick,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<
    "details" | "network" | "resources"
  >("details");

  if (!node) return null;

  const getColor = (group: number) => {
    const colors: Record<
      number,
      { text: string; border: string; bg: string; hex: string }
    > = {
      1: {
        text: "text-clinical-cyan",
        border: "border-clinical-cyan",
        bg: "bg-clinical-cyan",
        hex: "#06b6d4",
      },
      2: {
        text: "text-clinical-rose",
        border: "border-clinical-rose",
        bg: "bg-clinical-rose",
        hex: "#f43f5e",
      },
      3: {
        text: "text-clinical-purple",
        border: "border-clinical-purple",
        bg: "bg-clinical-purple",
        hex: "#8b5cf6",
      },
      4: {
        text: "text-clinical-teal",
        border: "border-clinical-teal",
        bg: "bg-clinical-teal",
        hex: "#14b8a6",
      },
      5: {
        text: "text-clinical-amber",
        border: "border-clinical-amber",
        bg: "bg-clinical-amber",
        hex: "#f59e0b",
      },
      6: {
        text: "text-blue-400",
        border: "border-blue-400",
        bg: "bg-blue-400",
        hex: "#3b82f6",
      },
      7: {
        text: "text-orange-400",
        border: "border-orange-400",
        bg: "bg-orange-400",
        hex: "#f97316",
      },
    };
    return (
      colors[group] || {
        text: "text-gray-400",
        border: "border-gray-400",
        bg: "bg-gray-400",
        hex: "#9ca3af",
      }
    );
  };

  const getIconComponent = (group: number) => {
    switch (group) {
      case 1:
        return Brain;
      case 2:
        return AlertTriangle;
      case 3:
        return Pill;
      case 4:
        return Heart;
      case 5:
        return Activity;
      case 6:
        return TestTube;
      case 7:
        return Stethoscope;
      default:
        return Circle;
    }
  };

  const getLabel = (group: number) => {
    const labels: Record<number, string> = {
      1: "Core Concept",
      2: "Pathology",
      3: "Medication",
      4: "Anatomy",
      5: "Physiology",
      6: "Diagnostic",
      7: "Clinical Sign",
    };
    return labels[group] || "Entity";
  };

  const outgoingLinks = graphData.links.filter(
    (l) =>
      l.source === node.id ||
      (typeof l.source === "object" && (l.source as any).id === node.id)
  );
  const incomingLinks = graphData.links.filter(
    (l) =>
      l.target === node.id ||
      (typeof l.target === "object" && (l.target as any).id === node.id)
  );

  const colors = getColor(node.group);
  const IconComponent = getIconComponent(node.group);
  const connectionCount = outgoingLinks.length + incomingLinks.length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] z-30 animate-[slideInRight_0.35s_cubic-bezier(0.16,1,0.3,1)] pointer-events-none">
      <div className="h-full bg-gradient-to-b from-[#0d0e12] via-[#0a0b0e] to-[#08090c] backdrop-blur-3xl border-l border-white/[0.06] shadow-[-40px_0_80px_rgba(0,0,0,0.7)] flex flex-col pointer-events-auto relative">
        {/* Accent glow */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${colors.hex}25 0%, transparent 70%)`,
          }}
        />

        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/[0.06] relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border backdrop-blur-sm ${colors.border}/30 ${colors.text} bg-black/40`}
            >
              <IconComponent size={12} strokeWidth={2.5} />
              <span className="text-[9px] font-black tracking-widest uppercase">
                {getLabel(node.group)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <h2 className="text-3xl font-serif font-light text-white leading-tight tracking-tight mb-2">
            {node.label}
          </h2>

          {node.description && (
            <p className="text-sm text-gray-400 leading-relaxed">
              {node.description}
            </p>
          )}

          {/* Synonyms */}
          {node.synonyms && node.synonyms.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Tag size={10} className="text-gray-500" />
              {node.synonyms.map((syn, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-gray-400"
                >
                  {syn}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/[0.06]">
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">
                Links
              </span>
              <span className="text-xl font-mono font-light text-white">
                {connectionCount}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">
                Weight
              </span>
              <span className="text-xl font-mono font-light text-white">
                {node.val}
                <span className="text-xs text-gray-600">/20</span>
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">
                ID
              </span>
              <button
                onClick={() => handleCopy(node.id, node.id)}
                className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-white transition-all"
              >
                {copiedId === node.id ? (
                  <Check size={10} className="text-green-500" />
                ) : (
                  <Copy size={10} />
                )}
                <span className="truncate max-w-[70px]">{node.id}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.06] px-6">
          {[
            { id: "details", label: "Clinical", icon: FileText },
            { id: "network", label: "Network", icon: Sparkles },
            { id: "resources", label: "Resources", icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeSection === tab.id
                  ? `${colors.text} border-current`
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {activeSection === "details" && (
            <>
              {/* Clinical Pearl */}
              {node.clinicalPearl && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      High-Yield Pearl
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {node.clinicalPearl}
                  </p>
                </div>
              )}

              {/* Details */}
              {node.details && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/[0.06]">
                    <Microscope size={12} className="text-clinical-cyan" />
                    In-Depth Analysis
                  </h3>
                  <div className="prose prose-sm prose-invert max-w-none text-gray-300 text-[14px] leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="font-serif mb-3">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="text-white font-semibold">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <em className="text-clinical-cyan">{children}</em>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 space-y-1">
                            {children}
                          </ul>
                        ),
                        li: ({ children }) => (
                          <li className="text-gray-300">{children}</li>
                        ),
                      }}
                    >
                      {node.details}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Differentials */}
              {node.differentials && node.differentials.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Differential Diagnosis
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {node.differentials.map((diff, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 bg-clinical-rose/10 border border-clinical-rose/20 text-clinical-rose rounded"
                      >
                        {diff}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === "network" && (
            <>
              {outgoingLinks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <ArrowRight size={12} />
                    Downstream ({outgoingLinks.length})
                  </div>
                  <div className="space-y-2">
                    {outgoingLinks.map((link, i) => {
                      const targetId =
                        typeof link.target === "object"
                          ? (link.target as any).id
                          : link.target;
                      const targetNode = graphData.nodes.find(
                        (n) => n.id === targetId
                      );
                      if (!targetNode) return null;
                      const targetColors = getColor(targetNode.group);
                      return (
                        <button
                          key={i}
                          onClick={() => onNodeClick(targetNode.id)}
                          className="w-full group flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.1] transition-all text-left"
                        >
                          <div
                            className={`w-1.5 h-8 rounded-full ${targetColors.bg}/50`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-gray-500 font-mono uppercase">
                              {link.relationship}
                            </div>
                            <div className="text-sm text-gray-200 group-hover:text-white truncate">
                              {targetNode.label}
                            </div>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {incomingLinks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    <ArrowLeft size={12} />
                    Upstream ({incomingLinks.length})
                  </div>
                  <div className="space-y-2">
                    {incomingLinks.map((link, i) => {
                      const sourceId =
                        typeof link.source === "object"
                          ? (link.source as any).id
                          : link.source;
                      const sourceNode = graphData.nodes.find(
                        (n) => n.id === sourceId
                      );
                      if (!sourceNode) return null;
                      const sourceColors = getColor(sourceNode.group);
                      return (
                        <button
                          key={i}
                          onClick={() => onNodeClick(sourceNode.id)}
                          className="w-full group flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.1] transition-all text-left"
                        >
                          <div
                            className={`w-1.5 h-8 rounded-full ${sourceColors.bg}/50`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-gray-500 font-mono uppercase">
                              {link.relationship}
                            </div>
                            <div className="text-sm text-gray-200 group-hover:text-white truncate">
                              {sourceNode.label}
                            </div>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-gray-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {connectionCount === 0 && (
                <div className="text-center py-10 text-gray-500 text-sm">
                  No connections found for this node.
                </div>
              )}
            </>
          )}

          {activeSection === "resources" && (
            <div className="space-y-4">
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(
                  node.label
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg bg-clinical-cyan/5 border border-clinical-cyan/20 hover:bg-clinical-cyan/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-clinical-cyan/20 flex items-center justify-center">
                  <BookOpen size={18} className="text-clinical-cyan" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white group-hover:text-clinical-cyan transition-colors">
                    PubMed
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Search peer-reviewed literature
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-gray-500 group-hover:text-clinical-cyan"
                />
              </a>

              <a
                href={`https://www.uptodate.com/contents/search?search=${encodeURIComponent(
                  node.label
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <FileText size={18} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">UpToDate</div>
                  <div className="text-[11px] text-gray-500">
                    Evidence-based clinical resource
                  </div>
                </div>
                <ExternalLink size={14} className="text-gray-500" />
              </a>

              <a
                href={`https://radiopaedia.org/search?utf8=%E2%9C%93&q=${encodeURIComponent(
                  node.label
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <Microscope size={18} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    Radiopaedia
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Medical imaging reference
                  </div>
                </div>
                <ExternalLink size={14} className="text-gray-500" />
              </a>

              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(
                  node.label +
                    " pathophysiology site:ncbi.nlm.nih.gov OR site:who.int"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <Search size={18} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    Scholar Search
                  </div>
                  <div className="text-[11px] text-gray-500">
                    NIH & WHO sources only
                  </div>
                </div>
                <ExternalLink size={14} className="text-gray-500" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeInspector;
