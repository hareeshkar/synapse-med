import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  memo,
} from "react";
import * as d3 from "d3";
import { KnowledgeGraphData, KnowledgeNode } from "../types";
import {
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Brain,
  Target,
  Search,
  X,
  Pill,
  Heart,
  AlertTriangle,
  RotateCcw,
  Grid3X3,
  Circle,
  Atom,
  Maximize2,
  Minimize2,
  Link2,
  Zap,
  Activity,
  Stethoscope,
  TestTube,
} from "lucide-react";

interface KnowledgeGraphProps {
  data: KnowledgeGraphData;
  className?: string;
  onNodeSelect: (node: KnowledgeNode | null) => void;
  selectedNodeId?: string | null;
  inspectorOpen?: boolean;
}

interface GraphNode extends KnowledgeNode, d3.SimulationNodeDatum {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  relationship: string;
  source: GraphNode | string;
  target: GraphNode | string;
}

// Optimized layout constants - reduced for better performance
const LAYOUT = {
  NODE_BASE_RADIUS: 18,
  NODE_SCALE: 3,
  LINK_DISTANCE: 200, // Reduced from 250
  CHARGE_STRENGTH: -800, // Reduced from -1000
  COLLISION_PADDING: 50, // Reduced from 60
  CLUSTER_RADIUS: 250, // Reduced from 300
  ANIMATION_DURATION: 600, // Reduced from 800
} as const;

// Group configuration - memoized outside component
const GROUP_CONFIG: Record<
  number,
  { name: string; color: string; dark: string; icon: string }
> = {
  1: { name: "Core Concept", color: "#06b6d4", dark: "#0891b2", icon: "◉" },
  2: { name: "Pathology", color: "#f43f5e", dark: "#e11d48", icon: "⚠" },
  3: { name: "Medication", color: "#8b5cf6", dark: "#7c3aed", icon: "◆" },
  4: { name: "Anatomy", color: "#14b8a6", dark: "#0d9488", icon: "♥" },
  5: { name: "Physiology", color: "#f59e0b", dark: "#d97706", icon: "⚡" },
  6: { name: "Diagnostic", color: "#3b82f6", dark: "#2563eb", icon: "◈" },
  7: { name: "Clinical Sign", color: "#f97316", dark: "#ea580c", icon: "◐" },
};

const getGroupConfig = (group: number) =>
  GROUP_CONFIG[group] || {
    name: "Other",
    color: "#64748b",
    dark: "#475569",
    icon: "●",
  };

const getGroupIcon = (group: number) => {
  switch (group) {
    case 1: return Brain;
    case 2: return AlertTriangle;
    case 3: return Pill;
    case 4: return Heart;
    case 5: return Activity;
    case 6: return TestTube;
    case 7: return Stethoscope;
    default: return Circle;
  }
};

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = memo(
  ({ data, className, onNodeSelect, selectedNodeId }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Set<number>>(
      new Set([1, 2, 3, 4, 5, 6, 7])
    );
    const [showLabels, setShowLabels] = useState(true);
    const [layoutMode, setLayoutMode] = useState<"clustered" | "radial" | "force">("clustered");
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

    // Refs for click outside
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const toolbarContainerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // D3 Refs
    const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

    // Filtered data - optimized with deep clone prevention
    const filteredData = useMemo(() => {
      let nodes = data.nodes.filter((n) => activeFilters.has(n.group));
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        nodes = nodes.filter(
          (n) =>
            n.label.toLowerCase().includes(query) ||
            n.description?.toLowerCase().includes(query)
        );
      }
      
      const nodeIds = new Set(nodes.map((n) => n.id));
      const links = data.links.filter((l) => {
        const sId = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const tId = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        return nodeIds.has(sId as string) && nodeIds.has(tId as string);
      });

      return {
        nodes: nodes.map((n) => ({ ...n })) as GraphNode[],
        links: links.map((l) => ({ ...l })) as GraphLink[],
      };
    }, [data, activeFilters, searchQuery]);

    // Connected nodes for highlighting
    const connectedNodeIds = useMemo(() => {
      if (!selectedNodeId) return new Set<string>();
      const ids = new Set<string>();
      filteredData.links.forEach((l) => {
        const sId = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const tId = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        if (sId === selectedNodeId) ids.add(tId as string);
        if (tId === selectedNodeId) ids.add(sId as string);
      });
      return ids;
    }, [selectedNodeId, filteredData.links]);

    // Node connection counts for sizing - optimized
    const nodeConnections = useMemo(() => {
      const counts: Record<string, number> = {};
      filteredData.links.forEach((l) => {
        const sId = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const tId = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        counts[sId as string] = (counts[sId as string] || 0) + 1;
        counts[tId as string] = (counts[tId as string] || 0) + 1;
      });
      return counts;
    }, [filteredData.links]);

    const getNodeRadius = useCallback(
      (node: GraphNode) => {
        const connections = nodeConnections[node.id] || 0;
        return LAYOUT.NODE_BASE_RADIUS + Math.min(connections * LAYOUT.NODE_SCALE, 20);
      },
      [nodeConnections]
    );

    // Initialize Graph - optimized with fewer DOM operations
    useEffect(() => {
      if (!svgRef.current || !containerRef.current || !filteredData.nodes.length) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      // Clear previous
      d3.select(svgRef.current).selectAll("*").remove();

      const svg = d3.select(svgRef.current).attr("viewBox", [0, 0, width, height]);
      svgSelectionRef.current = svg;

      // --- DEFS (Simplified for performance) ---
      const defs = svg.append("defs");

      // Single glow filter
      const glowFilter = defs.append("filter")
        .attr("id", "glow")
        .attr("x", "-50%").attr("y", "-50%")
        .attr("width", "200%").attr("height", "200%");
      glowFilter.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "coloredBlur");
      const merge = glowFilter.append("feMerge");
      merge.append("feMergeNode").attr("in", "coloredBlur");
      merge.append("feMergeNode").attr("in", "SourceGraphic");

      // Strong glow for selected
      const strongGlow = defs.append("filter")
        .attr("id", "strong-glow")
        .attr("x", "-50%").attr("y", "-50%")
        .attr("width", "200%").attr("height", "200%");
      strongGlow.append("feGaussianBlur").attr("stdDeviation", 8).attr("result", "coloredBlur");
      const merge2 = strongGlow.append("feMerge");
      merge2.append("feMergeNode").attr("in", "coloredBlur");
      merge2.append("feMergeNode").attr("in", "SourceGraphic");

      // Gradients (only create once)
      Object.entries(GROUP_CONFIG).forEach(([groupId, config]) => {
        const gradient = defs.append("radialGradient")
          .attr("id", `gradient-${groupId}`)
          .attr("cx", "30%").attr("cy", "30%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", config.color).attr("stop-opacity", 1);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", config.dark).attr("stop-opacity", 0.9);
      });

      // Arrow markers
      defs.append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25).attr("refY", 0)
        .attr("markerWidth", 5).attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path").attr("fill", "#9ca3af").attr("d", "M0,-5L10,0L0,5");

      defs.append("marker")
        .attr("id", "arrow-active")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path").attr("fill", "#ffffff").attr("d", "M0,-5L10,0L0,5");

      // --- LAYERS ---
      const g = svg.append("g");
      gRef.current = g;

      // Background Grid
      const gridPattern = defs
        .append("pattern")
        .attr("id", "grid")
        .attr("width", 60)
        .attr("height", 60)
        .attr("patternUnits", "userSpaceOnUse");
      gridPattern
        .append("circle")
        .attr("cx", 1)
        .attr("cy", 1)
        .attr("r", 1)
        .attr("fill", "rgba(255, 255, 255, 0.05)");
      g.append("rect")
        .attr("width", width * 4)
        .attr("height", height * 4)
        .attr("x", -width * 1.5)
        .attr("y", -height * 1.5)
        .attr("fill", "url(#grid)")
        .style("pointer-events", "none");

      // Zoom Behavior with touch support for tablets/iPads
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .touchable(() => true) // Enable touch events
        .filter((event) => {
          // Allow zoom for touch events (pinch) and mouse wheel
          // Prevent zoom on double-click for better touch UX
          if (event.type === "dblclick") return false;
          if (
            event.type === "touchstart" ||
            event.type === "touchmove" ||
            event.type === "touchend"
          ) {
            // Allow pinch-zoom (2 fingers)
            return event.touches ? event.touches.length >= 2 : true;
          }
          return !event.button; // Standard mouse behavior
        })
        .on("zoom", (e) => g.attr("transform", e.transform));
      svg.call(zoom).on("dblclick.zoom", null); // Disable double-click zoom for touch devices
      zoomRef.current = zoom;

      // --- SIMULATION SETUP ---
      const nodes = filteredData.nodes;
      const links = filteredData.links;

      // Initial positions
      nodes.forEach((node) => {
        if (!node.x) node.x = centerX + (Math.random() - 0.5) * 200;
        if (!node.y) node.y = centerY + (Math.random() - 0.5) * 200;
      });

      const simulation = d3
        .forceSimulation<GraphNode, GraphLink>(nodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(links)
            .id((d) => d.id)
            .distance(LAYOUT.LINK_DISTANCE)
        )
        .force(
          "charge",
          d3.forceManyBody<GraphNode>().strength(LAYOUT.CHARGE_STRENGTH)
        )
        .force(
          "collide",
          d3
            .forceCollide<GraphNode>()
            .radius((d) => getNodeRadius(d) + LAYOUT.COLLISION_PADDING)
            .strength(0.8)
        )
        .force("center", d3.forceCenter(centerX, centerY).strength(0.05))
        .force("bounds", () => {
          // Constrain nodes within reasonable bounds to prevent excessive graph growth
          const maxX = width * 1.5;
          const maxY = height * 1.5;
          nodes.forEach((node) => {
            if (node.x! > maxX) node.x = maxX;
            if (node.x! < -maxX / 2) node.x = -maxX / 2;
            if (node.y! > maxY) node.y = maxY;
            if (node.y! < -maxY / 2) node.y = -maxY / 2;
          });
        });

      simulationRef.current = simulation;

      // --- DRAWING ---

      // --- HULLS (Background Blobs) ---
      const hullGroup = g.append("g").attr("class", "hulls");

      // --- LINKS ---
      const linkGroup = g.append("g").attr("class", "links");
      const linkPath = linkGroup
        .selectAll<SVGPathElement, GraphLink>("path")
        .data(links)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#374151")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.3)
        .attr("marker-end", "url(#arrow)");

      // Link Labels (Background + Text)
      const linkLabelGroup = g.append("g").attr("class", "link-labels");

      const linkLabelG = linkLabelGroup
        .selectAll<SVGGElement, GraphLink>("g")
        .data(links)
        .join("g")
        .attr("opacity", 0); // Hidden by default

      linkLabelG
        .append("rect")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", "#000")
        .attr("fill-opacity", 0.7);

      linkLabelG
        .append("text")
        .text((d) => d.relationship)
        .attr("font-family", "Inter, sans-serif")
        .attr("font-size", "10px")
        .attr("fill", "#9ca3af")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em");

      // Nodes
      const nodeGroup = g.append("g").attr("class", "nodes");
      const node = nodeGroup
        .selectAll<SVGGElement, GraphNode>("g")
        .data(nodes)
        .join("g")
        .attr("cursor", "pointer")
        .call(
          d3
            .drag<SVGGElement, GraphNode>()
            .touchable(() => true) // Enable touch dragging for tablets
            .on("start", (event, d) => {
              // Prevent default touch behavior for smoother dragging
              if (event.sourceEvent) {
                event.sourceEvent.stopPropagation();
                if (event.sourceEvent.type?.startsWith("touch")) {
                  event.sourceEvent.preventDefault();
                }
              }
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              if (d.id !== selectedNodeId) {
                // Don't release if selected (Focus Mode)
                d.fx = null;
                d.fy = null;
              }
            })
        );

      // Node Interaction - Enhanced for touch devices
      node.on("click", (event, d) => {
        event.stopPropagation();
        setHoveredNode(null);
        // Use setTimeout to ensure state updates don't conflict
        requestAnimationFrame(() => {
          onNodeSelect(d.id === selectedNodeId ? null : d);
        });
      });

      // Touch-specific tap handler for better tablet UX
      node.on("touchend", (event, d) => {
        // Only trigger on simple taps (no drag)
        if (event.defaultPrevented) return;

        const touch = event.changedTouches?.[0];
        if (!touch) return;

        event.preventDefault();
        event.stopPropagation();
        setHoveredNode(null);

        requestAnimationFrame(() => {
          onNodeSelect(d.id === selectedNodeId ? null : d);
        });
      });

      node
        .on("mouseenter", function (event, d) {
          // Don't show tooltip if node is already selected
          if (d.id !== selectedNodeId) {
            setHoveredNode(d);
          }
          d3.select(this)
            .select(".node-main")
            .transition()
            .duration(200)
            .attr(
              "filter",
              d.id === selectedNodeId ? "url(#strong-glow)" : "url(#glow)"
            );
        })
        .on("mouseleave", function (event, d) {
          setHoveredNode(null);
          // Maintain glow if selected
          d3.select(this)
            .select(".node-main")
            .transition()
            .duration(200)
            .attr(
              "filter",
              d.id === selectedNodeId ? "url(#strong-glow)" : null
            );
        });

      // Node Visuals
      node
        .append("circle")
        .attr("class", "node-ring")
        .attr("r", (d) => getNodeRadius(d) + 6)
        .attr("fill", "none")
        .attr("stroke", (d) => getGroupConfig(d.group).color)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.2)
        .attr("stroke-dasharray", "4,4");

      node
        .append("circle")
        .attr("class", "node-main")
        .attr("r", (d) => getNodeRadius(d))
        .attr("fill", (d) => `url(#gradient-${d.group})`)
        .attr("stroke", (d) => getGroupConfig(d.group).color)
        .attr("stroke-width", 2);

      node
        .append("text")
        .attr("class", "node-icon")
        .text((d) => getGroupConfig(d.group).icon)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", (d) => Math.max(12, getNodeRadius(d) * 0.6))
        .attr("fill", "white")
        .style("pointer-events", "none");

      // Node Labels
      const labelGroup = g.append("g").attr("class", "labels");
      const label = labelGroup
        .selectAll<SVGGElement, GraphNode>("g")
        .data(nodes)
        .join("g")
        .style("opacity", showLabels ? 1 : 0);

      label
        .append("rect")
        .attr("fill", "rgba(0,0,0,0.6)")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5);

      label
        .append("text")
        .text((d) => d.label)
        .attr("font-family", "Inter, sans-serif")
        .attr("font-size", "11px")
        .attr("font-weight", "500")
        .attr("fill", "#e5e7eb")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .each(function (d) {
          const bbox = this.getBBox();
          const parent = d3.select(this.parentNode as Element);
          parent
            .select("rect")
            .attr("x", bbox.x - 6)
            .attr("y", bbox.y - 4)
            .attr("width", bbox.width + 12)
            .attr("height", bbox.height + 8);
        });

      // --- TICK FUNCTION ---
      simulation.on("tick", () => {
        // Update Hulls
        if (layoutMode === "clustered" && !selectedNodeId) {
          const groups = d3.group(nodes, (d) => d.group);
          const hullData: [number, GraphNode[]][] = Array.from(
            groups.entries()
          );

          const hulls = hullGroup
            .selectAll<SVGPathElement, [number, GraphNode[]]>("path")
            .data(hullData)
            .join("path")
            .attr("fill", (d) => getGroupConfig(d[0]).color)
            .attr("fill-opacity", 0.05)
            .attr("stroke", (d) => getGroupConfig(d[0]).color)
            .attr("stroke-width", 20)
            .attr("stroke-linejoin", "round")
            .attr("stroke-opacity", 0.05)
            .attr("d", (d) => {
              const points: [number, number][] = d[1].map((n) => [n.x!, n.y!]);
              if (points.length < 3) return null; // Need at least 3 points for a hull
              const hull = d3.polygonHull(points);
              return hull ? "M" + hull.join("L") + "Z" : null;
            });
        } else {
          hullGroup.selectAll("path").remove();
        }

        // Curved Lines
        linkPath.attr("d", (d) => {
          const source = d.source as GraphNode;
          const target = d.target as GraphNode;
          // Simple quadratic bezier for curve
          // Midpoint with offset for curve
          const midX = (source.x! + target.x!) / 2;
          const midY = (source.y! + target.y!) / 2;

          // Calculate normal vector for slight curve
          const dx = target.x! - source.x!;
          const dy = target.y! - source.y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const normalX = -dy / dist;
          const normalY = dx / dist;

          // Curve amount depends on distance
          const curveAmount = dist * 0.1;
          const cX = midX + normalX * curveAmount;
          const cY = midY + normalY * curveAmount;

          return `M${source.x},${source.y} Q${cX},${cY} ${target.x},${target.y}`;
        });

        // Update Link Labels position (at curve midpoint)
        linkLabelG.attr("transform", (d) => {
          const source = d.source as GraphNode;
          const target = d.target as GraphNode;
          const midX = (source.x! + target.x!) / 2;
          const midY = (source.y! + target.y!) / 2;
          const dx = target.x! - source.x!;
          const dy = target.y! - source.y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const normalX = -dy / dist;
          const normalY = dx / dist;
          const curveAmount = dist * 0.1;
          const cX = midX + normalX * curveAmount;
          const cY = midY + normalY * curveAmount;
          return `translate(${cX},${cY})`;
        });

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
        label.attr(
          "transform",
          (d) => `translate(${d.x},${d.y! + getNodeRadius(d) + 20})`
        );
      });

      return () => {
        simulation.stop();
      };
    }, [filteredData, getNodeRadius, onNodeSelect, showLabels]);

    // --- FOCUS MODE & SELECTION EFFECTS ---
    useEffect(() => {
      if (!simulationRef.current || !containerRef.current) return;
      const simulation = simulationRef.current;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      if (selectedNodeId) {
        // --- FOCUS MODE ---
        // 1. Center the selected node
        // 2. Pull connected nodes close
        // 3. Push everything else away

        simulation.alpha(0.5).restart();

        // Reset previous forces to avoid conflict
        simulation.force("center", null);
        simulation.force("radial", null);
        simulation.force("cluster", null);

        // Strong radial force to organize concentric circles
        simulation.force(
          "radial",
          d3
            .forceRadial<GraphNode>(
              (d) => {
                if (d.id === selectedNodeId) return 0; // Center
                if (connectedNodeIds.has(d.id)) return 200; // Inner orbit
                return 600; // Outer orbit (pushed away)
              },
              centerX,
              centerY
            )
            .strength((d) => {
              if (d.id === selectedNodeId) return 1;
              if (connectedNodeIds.has(d.id)) return 0.8;
              return 0.6;
            })
        );

        // Stronger collision to prevent overlap in the center
        simulation.force(
          "collide",
          d3
            .forceCollide<GraphNode>()
            .radius((d) => getNodeRadius(d) + 50)
            .strength(1)
        );

        // Adjust Charge
        simulation.force(
          "charge",
          d3.forceManyBody<GraphNode>().strength((d) => {
            if (d.id === selectedNodeId) return -2000;
            return -1000;
          })
        );
      } else {
        // --- DEFAULT MODE ---
        // Restore default spacious layout
        simulation.force(
          "center",
          d3.forceCenter(centerX, centerY).strength(0.05)
        );
        simulation.force("radial", null);

        if (layoutMode === "clustered") {
          // Re-apply cluster forces if needed (simplified here for now)
          simulation.force(
            "charge",
            d3.forceManyBody().strength(LAYOUT.CHARGE_STRENGTH)
          );
        }

        simulation.alpha(0.3).restart();
      }

      // --- VISUAL UPDATES ---
      if (!gRef.current) return;
      const g = gRef.current;

      const nodes = g.selectAll<SVGGElement, GraphNode>(".nodes g");
      const links = g.selectAll<SVGPathElement, GraphLink>(".links path");
      const linkLabels = g.selectAll<SVGGElement, GraphLink>(".link-labels g");
      const labels = g.selectAll<SVGGElement, GraphNode>(".labels g");

      if (!selectedNodeId) {
        // Reset visuals
        nodes.style("opacity", 1);
        nodes.select(".node-main").attr("filter", null).attr("stroke-width", 2);
        nodes
          .select(".node-ring")
          .attr("stroke-opacity", 0.2)
          .attr("stroke", (d) => getGroupConfig(d.group).color);

        links
          .attr("stroke", "#374151")
          .attr("stroke-opacity", 0.3)
          .attr("stroke-width", 1.5)
          .attr("marker-end", "url(#arrow)")
          .attr("stroke-dasharray", null) // Remove animation
          .classed("animate-flow", false);

        linkLabels.transition().duration(200).attr("opacity", 0);
        labels.style("opacity", showLabels ? 1 : 0);
        return;
      }

      // Dim unconnected
      nodes
        .transition()
        .duration(400)
        .style("opacity", (d) => {
          if (d.id === selectedNodeId || connectedNodeIds.has(d.id)) return 1;
          return 0.1; // Fade out others significantly
        });

      // Highlight Selected
      nodes
        .select(".node-main")
        .transition()
        .duration(400)
        .attr("filter", (d) =>
          d.id === selectedNodeId
            ? "url(#strong-glow)"
            : connectedNodeIds.has(d.id)
            ? "url(#glow)"
            : null
        )
        .attr("stroke-width", (d) => (d.id === selectedNodeId ? 4 : 2));

      // Highlight Rings
      nodes
        .select(".node-ring")
        .transition()
        .duration(400)
        .attr("stroke", (d) =>
          d.id === selectedNodeId ? "#ffffff" : getGroupConfig(d.group).color
        )
        .attr("stroke-opacity", (d) =>
          d.id === selectedNodeId ? 0.8 : connectedNodeIds.has(d.id) ? 0.5 : 0.1
        );

      // Highlight Links (White & Animated)
      links
        .transition()
        .duration(400)
        .attr("stroke", (l) => {
          const sId = (l.source as GraphNode).id;
          const tId = (l.target as GraphNode).id;
          if (sId === selectedNodeId || tId === selectedNodeId)
            return "#ffffff";
          return "#374151";
        })
        .attr("stroke-opacity", (l) => {
          const sId = (l.source as GraphNode).id;
          const tId = (l.target as GraphNode).id;
          if (sId === selectedNodeId || tId === selectedNodeId) return 1;
          return 0.05;
        })
        .attr("stroke-width", (l) => {
          const sId = (l.source as GraphNode).id;
          const tId = (l.target as GraphNode).id;
          if (sId === selectedNodeId || tId === selectedNodeId) return 3;
          return 1;
        })
        .attr("marker-end", (l) => {
          const sId = (l.source as GraphNode).id;
          const tId = (l.target as GraphNode).id;
          if (sId === selectedNodeId || tId === selectedNodeId)
            return "url(#arrow-active)";
          return "url(#arrow)";
        })
        .on("end", function (l) {
          // Add animation class after transition
          const sId = (l.source as GraphNode).id;
          const tId = (l.target as GraphNode).id;
          if (sId === selectedNodeId || tId === selectedNodeId) {
            d3.select(this)
              .attr("stroke-dasharray", "10,5")
              .classed("animate-flow", true); // We need to add this CSS
          }
        });

      // Show Link Labels for connected
      linkLabels
        .transition()
        .duration(400)
        .attr("opacity", (l) => {
          const sId = (l.source as GraphNode).id;
          const tId = (l.target as GraphNode).id;
          return sId === selectedNodeId || tId === selectedNodeId ? 1 : 0;
        });

      // Labels
      labels
        .transition()
        .duration(400)
        .style("opacity", (d) => {
          if (d.id === selectedNodeId || connectedNodeIds.has(d.id)) return 1;
          return 0; // Hide labels of unconnected nodes to reduce clutter
        });

      // Zoom to focus (optional, but nice)
      if (svgSelectionRef.current && zoomRef.current) {
        svgSelectionRef.current
          .transition()
          .duration(800)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity
              .translate(centerX - centerX, centerY - centerY)
              .scale(1) // Reset zoom to see the organized cluster
          );
      }
    }, [selectedNodeId, connectedNodeIds, layoutMode]);

    // Click outside to dismiss search
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          showSearch &&
          searchContainerRef.current &&
          toolbarContainerRef.current &&
          !searchContainerRef.current.contains(event.target as Node) &&
          !toolbarContainerRef.current.contains(event.target as Node)
        ) {
          setShowSearch(false);
          setSearchQuery("");
          // ensure caret/focus removed
          if (searchInputRef.current) searchInputRef.current.blur();
        }
      };

      if (showSearch) {
        document.addEventListener("mousedown", handleClickOutside);
        // Focus the input when search opens
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showSearch]);

    // Keyboard: Escape closes the search and blurs the input
    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && showSearch) {
          setShowSearch(false);
          setSearchQuery("");
          if (searchInputRef.current) searchInputRef.current.blur();
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [showSearch]);

    const toggleFilter = (group: number) => {
      setActiveFilters((prev) => {
        const next = new Set(prev);
        if (next.has(group)) {
          if (next.size > 1) next.delete(group);
        } else {
          next.add(group);
        }
        return next;
      });
    };

    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-[#030406] ${className}`}
        style={{ touchAction: "none" }} // Prevent browser handling of touch gestures
      >
        {/* CSS for flow animation + toolbar/search transitions + touch optimization */}
        <style>{`
            @keyframes flow {
                to { stroke-dashoffset: -30; }
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            .animate-flow {
                animation: flow 1s linear infinite;
            }
            
            /* Touch device detection via media query */
            @media (pointer: coarse) {
              .touch-device\\:block { display: block !important; }
              .touch-device\\:hidden { display: none !important; }
            }
            @media (pointer: fine) {
              .touch-device\\:block { display: none !important; }
            }
            
            /* Touch optimization for tablets/iPads */
            .kg-touch-target {
              touch-action: manipulation;
              -webkit-tap-highlight-color: transparent;
            }
            
            /* Tablet-optimized font sizes and touch targets */
            @media (pointer: coarse) {
              .kg-filter-pill {
                min-height: 44px;
                min-width: 44px;
                padding: 0.75rem 1rem;
                font-size: 12px; /* Larger font for tablet readability */
              }
              .kg-control-btn {
                min-height: 44px;
                min-width: 44px;
              }
              
              /* Increase overall text sizes for tablet readability */
              .kg-tablet-text {
                font-size: 13px;
              }
              .kg-tablet-text-sm {
                font-size: 11px;
              }
              .kg-tablet-text-lg {
                font-size: 15px;
              }
            }
            
            /* Better tooltip positioning on touch devices */
            @media (hover: none) {
              .kg-tooltip {
                display: none;
              }
            }

            /* smooth width/opacity transition and improved caret/line-height for search input */
            .kg-search-input {
              transition: opacity 180ms ease, width 220ms cubic-bezier(.2,.9,.2,1);
              font-size: 14px;
              line-height: 20px; /* keep caret normal height */
              height: 40px;
              padding: 0 8px;
              caret-color: #06b6d4; /* clinical cyan */
              outline: none;
              box-shadow: none;
              border: none;
              background: transparent;
              appearance: none;
            }

            /* When collapsed, hide the caret completely without leaving artifacts */
            .kg-search-input.caret-hidden {
              caret-color: transparent !important;
            }
        `}</style>

        {/* Tooltip Overlay */}
        {hoveredNode && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: 0,
              top: 0,
              transform: `translate(${hoveredNode.x! + 20}px, ${
                hoveredNode.y! - 20
              }px)`,
            }}
          >
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl min-w-[200px] animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {getGroupConfig(hoveredNode.group).icon}
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: getGroupConfig(hoveredNode.group).color }}
                >
                  {getGroupConfig(hoveredNode.group).name}
                </span>
              </div>
              <div className="text-sm font-semibold text-white mb-1">
                {hoveredNode.label}
              </div>
              {hoveredNode.description && (
                <div className="text-[10px] text-gray-200 leading-relaxed mb-2 max-w-[200px]">
                  {hoveredNode.description}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1">
                  <Link2 size={10} className="text-gray-500" />
                  <span className="text-[10px] text-gray-300">
                    {nodeConnections[hoveredNode.id] || 0} connections
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap size={10} className="text-clinical-amber" />
                  <span className="text-[10px] text-gray-300">
                    {hoveredNode.val * 10}% relevance
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between gap-4 pointer-events-none">
          {/* Left: Status & Filters */}
          <div className="flex flex-col gap-3 pointer-events-auto">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className="bg-black/70 backdrop-blur-lg px-3 py-2 rounded-lg border border-white/10 flex items-center gap-3 shadow-xl">
                <Atom size={14} className="text-clinical-cyan" />
                <span className="text-[11px] font-medium text-gray-200">
                  {filteredData.nodes.length} nodes ·{" "}
                  {filteredData.links.length} connections
                </span>
              </div>
            </div>

            {/* Filter Pills - Touch optimized for tablets */}
            <div className="flex gap-2 flex-wrap max-w-[320px] md:max-w-[400px]">
              {[1, 2, 3, 4, 5, 6, 7].map((group) => {
                const config = getGroupConfig(group);
                const Icon = getGroupIcon(group);
                const isActive = activeFilters.has(group);
                return (
                  <button
                    key={group}
                    onClick={() => toggleFilter(group)}
                    className={`
                      kg-filter-pill kg-touch-target flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold tracking-wide uppercase transition-all border
                      ${
                        isActive
                          ? `bg-${config.color}/10 border-${config.color}/30 text-white shadow-[0_0_10px_rgba(0,0,0,0.3)]`
                          : "bg-black/40 border-white/5 text-gray-300 hover:bg-white/5 hover:text-gray-200 active:bg-white/10"
                      }
                    `}
                    style={{
                      borderColor: isActive ? config.color : undefined,
                      backgroundColor: isActive
                        ? `${config.color}20`
                        : undefined,
                    }}
                  >
                    <Icon
                      size={12}
                      className={isActive ? "text-white" : "text-gray-300"}
                    />
                    <span className="hidden sm:inline">{config.name}</span>
                    <span className="sm:hidden">
                      {config.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Search & View Controls */}
          {/* Toolbar first, then search. On mobile stack vertically.
              When search expands, toolbar slides right with animation. */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 pointer-events-auto justify-end">
            {/* View Toggles: toolbar before search - Touch optimized */}
            <div
              ref={toolbarContainerRef}
              className="flex gap-2 items-center"
              style={{ minWidth: 0 }}
            >
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`kg-control-btn kg-touch-target p-2.5 rounded-lg border transition-all ${
                  showLabels
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-black/40 border-white/5 text-gray-500 active:bg-white/10"
                }`}
                title="Toggle Labels (L)"
              >
                {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button
                onClick={() => {
                  if (
                    svgSelectionRef.current &&
                    zoomRef.current &&
                    containerRef.current
                  ) {
                    const svgNode = svgSelectionRef.current.node()!;
                    const currentTransform = d3.zoomTransform(svgNode);
                    const width = containerRef.current.clientWidth;
                    const height = containerRef.current.clientHeight;
                    const centerX = width / 2;
                    const centerY = height / 2;

                    // Calculate zoom towards center
                    const newScale = Math.min(currentTransform.k * 1.5, 4);
                    const scaleFactor = newScale / currentTransform.k;
                    const newX =
                      centerX - (centerX - currentTransform.x) * scaleFactor;
                    const newY =
                      centerY - (centerY - currentTransform.y) * scaleFactor;

                    svgSelectionRef.current
                      .transition()
                      .duration(300)
                      .call(
                        zoomRef.current.transform,
                        d3.zoomIdentity.translate(newX, newY).scale(newScale)
                      );
                  }
                }}
                className="kg-control-btn kg-touch-target p-2.5 rounded-lg bg-black/40 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all"
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => {
                  if (
                    svgSelectionRef.current &&
                    zoomRef.current &&
                    containerRef.current
                  ) {
                    const svgNode = svgSelectionRef.current.node()!;
                    const currentTransform = d3.zoomTransform(svgNode);
                    const width = containerRef.current.clientWidth;
                    const height = containerRef.current.clientHeight;
                    const centerX = width / 2;
                    const centerY = height / 2;

                    // Calculate zoom towards center
                    const newScale = Math.max(currentTransform.k * 0.67, 0.1);
                    const scaleFactor = newScale / currentTransform.k;
                    const newX =
                      centerX - (centerX - currentTransform.x) * scaleFactor;
                    const newY =
                      centerY - (centerY - currentTransform.y) * scaleFactor;

                    svgSelectionRef.current
                      .transition()
                      .duration(300)
                      .call(
                        zoomRef.current.transform,
                        d3.zoomIdentity.translate(newX, newY).scale(newScale)
                      );
                  }
                }}
                className="kg-control-btn kg-touch-target p-2.5 rounded-lg bg-black/40 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all"
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                onClick={() => {
                  if (svgSelectionRef.current && zoomRef.current) {
                    svgSelectionRef.current
                      .transition()
                      .duration(500)
                      .call(zoomRef.current.transform, d3.zoomIdentity);
                  }
                }}
                className="kg-control-btn kg-touch-target p-2.5 rounded-lg bg-black/40 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all"
                title="Reset View"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div
              ref={searchContainerRef}
              className={`
                flex items-center bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden transition-all duration-300 shrink-0
                ${
                  showSearch
                    ? "shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-clinical-cyan/30"
                    : "bg-transparent border-transparent"
                }
             `}
              style={{
                width: showSearch ? 256 : 40,
                minWidth: showSearch ? 256 : 40,
              }}
            >
              <button
                onClick={() => {
                  // toggle search; when closing, blur and clear
                  if (!showSearch) {
                    setShowSearch(true);
                  } else {
                    setShowSearch(false);
                    setSearchQuery("");
                    if (searchInputRef.current) searchInputRef.current.blur();
                  }
                }}
                className="w-10 h-10 flex items-center justify-center text-gray-200 hover:text-white transition-colors flex-shrink-0"
              >
                <Search size={16} />
              </button>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                ref={searchInputRef}
                placeholder="Search nodes..."
                className={`kg-search-input w-full bg-transparent border-none text-sm text-white placeholder-gray-400 focus:ring-0 h-10 pr-3 ${
                  showSearch ? "opacity-100" : "opacity-0"
                } ${!showSearch ? "caret-hidden" : ""}`}
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mr-2 text-gray-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SVG Container */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onClick={() => {
            if (showSearch) {
              setShowSearch(false);
              setSearchQuery("");
              if (searchInputRef.current) searchInputRef.current.blur();
            }
          }}
        />

        {/* Select Node Hint - Positioned better */}
        {!selectedNodeId && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 glass-slide border border-white/[0.06] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-[fadeInUp_0.5s_ease-out_1s_both] pointer-events-none">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-3 h-3 rounded-full bg-vital-cyan/60 animate-pulse" />
              <span className="text-sm md:text-base font-medium">
                Tap a node to explore
              </span>
            </div>
          </div>
        )}

        {/* Touch hint for tablet users - shows on touch devices */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none hidden touch-device:block">
          <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-xl text-[10px] md:text-xs text-gray-500 font-mono flex items-center gap-3">
            <span>Pinch to zoom</span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span>Drag to pan</span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span>Tap node to select</span>
          </div>
        </div>
      </div>
    );
  }
);

export default KnowledgeGraph;
