import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle
} from 'reactflow';

import dagre from 'dagre';
import 'reactflow/dist/style.css';
import '../App.css';
import { Zap, Search, Code, List, Loader, MapPin, ChevronRight, ArrowRight, ArrowLeft, Layers, Key, Lock, Unlock, Home, FileCode, Lightbulb, Eye, EyeOff, Save, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

// ─── Custom graph node ────────────────────────────────────────────────────────

const CustomNode = ({ data, selected }: any) => {
  const isSymbol = data.type === 'Symbol';
  const isFile   = data.type === 'File';
  const displayLabel = isSymbol
    ? `${data.label}()`
    : isFile
      ? (data.label as string).split(/[/\\]/).pop()
      : data.label;

  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span className={`node-chip ${data.type}`}>
          {isSymbol ? (data.properties.kind || 'symbol') : data.type}
        </span>
      </div>

      <div className="node-label">
        {displayLabel}
      </div>

      {isSymbol && data.fileName && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--mongodb-gray-light-2)',
          marginTop: '6px',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <MapPin size={10} />
          {data.fileName}
        </div>
      )}

      {data.properties.purpose && (
        <div className="node-doc">
          {data.properties.purpose}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
};

// ─── Dagre layout ─────────────────────────────────────────────────────────────

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 240, height: 80 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const p = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    node.position = { x: p.x - 120, y: p.y - 40 };
    return node;
  });
  return { nodes, edges };
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunctionItem {
  name: string;
  kind: string;
  inputs: string[];
  outputs: string[];
  calls: string[];
  location: { file: string; fileName: string; line: number };
  id: string;
}

interface SymbolDetails {
  name: string;
  kind: string;
  filePath: string;
  range: any;
  inputs: string[];
  outputs: string[];
  purpose: string | null;
  strategy: string | null;
  callers: { name: string; kind: string }[];
  callees: { name: string; kind: string }[];
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

function Explorer() {
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = new URLSearchParams(location.search).get('workspace');

  // Graph
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [symbolDetails, setSymbolDetails] = useState<SymbolDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Functions list
  const [functions, setFunctions] = useState<FunctionItem[]>([]);
  const [functionsLoading, setFunctionsLoading] = useState(true);
  const [view, setView] = useState<'graph' | 'list'>('list');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Purpose / API key
  const [apiKey, setApiKey] = useState('');
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [purposeLoading, setPurposeLoading] = useState(false);
  const [purposeResult, setPurposeResult] = useState<{ purpose: string; strategy: string } | null>(null);

  // Hidden functions for custom graph view
  const [hiddenFunctions, setHiddenFunctions] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [customFileName, setCustomFileName] = useState('custom-graph');
  const [saving, setSaving] = useState(false);

  // ── Fetch graph ──────────────────────────────────────────────────────────────

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const url = workspace
        ? `http://localhost:9000/api/graph?workspace=${encodeURIComponent(workspace)}`
        : 'http://localhost:9000/api/graph';
      const res = await fetch(url);
      const data = await res.json();

      if (!data || !data.nodes || !data.edges) {
        console.error('API returned invalid graph data:', data);
        setNodes([]);
        setEdges([]);
        return;
      }

      const { nodes: ln, edges: le } = getLayoutedElements(
        data.nodes,
        data.edges.map((e: any) => ({
          ...e,
          animated: e.label === 'CALLS',
          style: {
            stroke: e.label === 'IMPORTS' ? '#016BF8' : e.label === 'CALLS' ? '#00ED64' : '#FFC010',
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: e.label === 'IMPORTS' ? '#016BF8' : e.label === 'CALLS' ? '#00ED64' : '#FFC010',
            width: 20, height: 20,
          },
        }))
      );
      setNodes(ln);
      setEdges(le);
    } catch (err) {
      console.error('Failed to fetch graph:', err);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch all functions ──────────────────────────────────────────────────────

  const fetchFunctions = async () => {
    try {
      setFunctionsLoading(true);
      const url = workspace
        ? `http://localhost:9000/api/functions?workspace=${encodeURIComponent(workspace)}`
        : 'http://localhost:9000/api/functions';
      const res = await fetch(url);
      if (res.ok) setFunctions((await res.json()).functions || []);
    } catch (err) {
      console.error('Failed to fetch functions:', err);
    } finally {
      setFunctionsLoading(false);
    }
  };

  useEffect(() => { fetchGraph(); fetchFunctions(); }, []);

  // ── Clear graph highlights ───────────────────────────────────────────────────

  const clearHighlights = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
    setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, opacity: 1, strokeWidth: 1.5 } })));
  }, [setNodes, setEdges]);

  // ── Node click → fetch details + highlight neighbours ────────────────────────

  const onNodeClick = useCallback(async (_: any, node: any) => {
    setSelectedNode(node);
    setSymbolDetails(null);
    setPurposeResult(null);
    setApiKeyValid(null);
    setShowApiKeyInput(false);

    if (node.data.type !== 'Symbol') return;

    setLoadingDetails(true);
    try {
      const res = await fetch(
        `http://localhost:9000/api/symbol/${encodeURIComponent(node.id)}`
      );
      if (!res.ok) return;
      const details: SymbolDetails = await res.json();
      setSymbolDetails(details);

      // Surface any previously generated purpose
      if (details.purpose) {
        setPurposeResult({ purpose: details.purpose, strategy: details.strategy || '' });
      }

      // Build related label set: self + callers + callees
      const relatedLabels = new Set([
        node.data.label,
        ...details.callers.map((c) => c.name),
        ...details.callees.map((c) => c.name),
      ]);

      // Dim unrelated nodes, keep related bright
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: { ...n.style, opacity: relatedLabels.has(n.data.label) ? 1 : 0.12 },
        }))
      );

      // Highlight edges touching this node, dim the rest
      setEdges((eds) =>
        eds.map((e) => {
          const connected = e.source === node.id || e.target === node.id;
          return {
            ...e,
            style: {
              ...e.style,
              opacity: connected ? 1 : 0.07,
              strokeWidth: connected ? 2.5 : 1.5,
            },
          };
        })
      );
    } catch (err) {
      console.error('Failed to fetch symbol details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [setNodes, setEdges]);

  // ── Background click → deselect ──────────────────────────────────────────────

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSymbolDetails(null);
    setPurposeResult(null);
    setApiKeyValid(null);
    setShowApiKeyInput(false);
    clearHighlights();
  }, [clearHighlights]);

  // ── Semantic search ──────────────────────────────────────────────────────────

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const res = await fetch('http://localhost:9000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const results = await res.json();
      const names = new Set(results.map((r: any) => r.symbolName));
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            border: names.has(n.data.label) ? '2px solid var(--mongodb-spring-green)' : undefined,
            boxShadow: names.has(n.data.label) ? '0 0 0 4px rgba(0, 237, 100, 0.2)' : undefined,
          },
        }))
      );
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  // ── Find Purpose (API key gated) ─────────────────────────────────────────────

  const handleFindPurpose = async () => {
    if (!selectedNode || !apiKey.trim()) return;
    setPurposeLoading(true);
    setApiKeyValid(null);
    try {
      const res = await fetch('http://localhost:9000/api/find-purpose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
        },
        body: JSON.stringify({ id: selectedNode.id }),
      });
      if (res.status === 401) { setApiKeyValid(false); return; }
      if (res.ok) {
        const result = await res.json();
        setApiKeyValid(true);
        setPurposeResult(result);
        setSymbolDetails((prev) =>
          prev ? { ...prev, purpose: result.purpose, strategy: result.strategy } : prev
        );
      }
    } catch (err) {
      console.error('Find purpose failed:', err);
    } finally {
      setPurposeLoading(false);
    }
  };

  // ── Click function in list → jump to graph node ──────────────────────────────

  const handleFunctionListClick = useCallback(
    async (fn: FunctionItem) => {
      const match = nodes.find((n) => n.data.label === fn.name);
      if (match) onNodeClick(null, match);
    },
    [nodes, onNodeClick]
  );

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filteredFunctions = useMemo(() => {
    let result = functions;
    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) => f.name.toLowerCase().includes(q) || f.location.fileName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [functions, searchQuery]);

  // Visible functions (excluding hidden ones)
  const visibleFunctions = useMemo(() => {
    return filteredFunctions.filter((f) => !hiddenFunctions.has(f.name));
  }, [filteredFunctions, hiddenFunctions]);

  // ── Grouped by file ──────────────────────────────────────────────────────────

  const functionsByFile = useMemo(() => {
    const map = new Map<string, { fileName: string; filePath: string; fns: FunctionItem[] }>();
    for (const fn of visibleFunctions) {
      const key = fn.location.file || fn.location.fileName;
      if (!map.has(key)) {
        map.set(key, { fileName: fn.location.fileName, filePath: fn.location.file, fns: [] });
      }
      map.get(key)!.fns.push(fn);
    }
    return Array.from(map.values()).sort((a, b) => a.fileName.localeCompare(b.fileName));
  }, [visibleFunctions]);

  const nodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  // ── Toggle function visibility ───────────────────────────────────────────────

  const toggleFunctionVisibility = useCallback((name: string) => {
    setHiddenFunctions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const showAllFunctions = useCallback(() => {
    setHiddenFunctions(new Set());
  }, []);

  const hideAllFunctions = useCallback(() => {
    setHiddenFunctions(new Set(functions.map((f) => f.name)));
  }, [functions]);

  // ── Save custom graph as MD ──────────────────────────────────────────────────

  const handleSaveCustomMd = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const visibleNames = visibleFunctions.map((f) => f.name);
      const res = await fetch('http://localhost:9000/api/save-custom-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace,
          visibleFunctions: visibleNames,
          fileName: customFileName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Saved ${data.functionCount} functions to ${data.path}`);
        setShowSaveModal(false);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save custom graph');
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────



  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">

      {/* ── Graph canvas ─────────────────────────────────────────────────────── */}
      <div
        className="graph-canvas"
        style={{ display: view === 'graph' ? 'flex' : 'none', position: 'relative', flex: 1 }}
      >
        {loading && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', zIndex: 10,
            transform: 'translate(-50%,-50%)',
            color: '#0071e3', fontSize: '17px', fontWeight: 500,
          }}>
            Loading Graph…
          </div>
        )}
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick} onPaneClick={onPaneClick}
          fitView style={{ background: 'var(--mongodb-forest)' }}
        >
          <Background color="var(--mongodb-slate)" gap={32} size={1} />
          <Controls />
          <MiniMap nodeStrokeColor="var(--mongodb-spring-green)" nodeColor="var(--mongodb-slate)" maskColor="rgba(0,0,0,0.5)" />
        </ReactFlow>
      </div>

      {/* ── Functions list canvas ────────────────────────────────────────────── */}
      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 64px', background: 'var(--mongodb-forest)' }}>
          {functionsLoading ? (
            <div style={{ color: 'var(--mongodb-gray-light-2)', textAlign: 'center', paddingTop: '120px' }}>
              <Loader size={48} className="animate-spin" style={{ marginBottom: '24px', opacity: 0.5 }} />
              <p style={{ fontSize: '18px', fontWeight: 500 }}>Indexing Function Graph…</p>
            </div>
          ) : functionsByFile.length === 0 ? (
            <div style={{ color: 'var(--mongodb-gray-light-2)', textAlign: 'center', paddingTop: '120px' }}>
              <Code size={64} strokeWidth={1} style={{ marginBottom: '24px' }} />
              <p style={{ fontSize: '18px', fontWeight: 500 }}>No entry points detected.</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '32px', fontFamily: 'var(--font-serif)', color: 'var(--mongodb-white)' }}>Code Inventory</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={showAllFunctions}
                      style={{
                        background: 'var(--mongodb-slate)', border: '1px solid var(--mongodb-border)',
                        borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
                        color: 'var(--mongodb-white)', fontSize: '12px', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <Eye size={14} /> Show All
                    </button>
                    <button
                      onClick={hideAllFunctions}
                      style={{
                        background: 'var(--mongodb-slate)', border: '1px solid var(--mongodb-border)',
                        borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
                        color: 'var(--mongodb-gray-light-2)', fontSize: '12px', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <EyeOff size={14} /> Hide All
                    </button>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      disabled={visibleFunctions.length === 0}
                      style={{
                        background: visibleFunctions.length > 0 ? 'var(--mongodb-spring-green)' : 'var(--mongodb-gray-dark-3)',
                        border: 'none', borderRadius: '8px', padding: '8px 14px',
                        cursor: visibleFunctions.length > 0 ? 'pointer' : 'not-allowed',
                        color: visibleFunctions.length > 0 ? '#000' : 'var(--mongodb-gray-light-2)',
                        fontSize: '12px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <Download size={14} /> Save as MD
                    </button>
                  </div>
                </div>
                <p style={{ color: 'var(--mongodb-gray-light-2)', fontSize: '15px' }}>
                  {visibleFunctions.length} of {filteredFunctions.length} functions visible
                  {hiddenFunctions.size > 0 && ` (${hiddenFunctions.size} hidden)`}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {functionsByFile.map((group, gi) => (
                  <div key={gi}>
                    {/* File header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      marginBottom: '16px', paddingBottom: '12px',
                      borderBottom: '1px solid var(--mongodb-border)',
                    }}>
                      <div style={{ background: 'var(--mongodb-slate)', padding: '8px', borderRadius: '8px' }}>
                        <FileCode size={18} color="var(--mongodb-spring-green)" />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600, color: 'var(--mongodb-white)' }}>
                        {group.fileName}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--mongodb-gray-light-2)', marginLeft: 'auto', background: 'var(--mongodb-gray-dark-3)', padding: '2px 8px', borderRadius: '4px' }}>
                        {group.fns.length} symbols
                      </span>
                    </div>

                    {/* Function rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {group.fns.map((fn, fi) => (
                        <div
                          key={fi}
                          onClick={() => { setView('graph'); setTimeout(() => handleFunctionListClick(fn), 50); }}
                          style={{
                            background: 'var(--mongodb-slate)', border: '1px solid var(--mongodb-border)',
                            borderRadius: '12px', padding: '16px 24px', cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--mongodb-spring-green)';
                            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(4px)';
                            (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-card)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--mongodb-border)';
                            (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
                            (e.currentTarget as HTMLDivElement).style.background = 'var(--mongodb-slate)';
                          }}
                        >
                          {/* Name + kind + line */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <span className="node-chip Symbol">{fn.kind}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600, color: 'var(--mongodb-white)', flex: 1 }}>
                              {fn.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--mongodb-gray-light-2)', fontWeight: 500 }}>
                              <MapPin size={12} color="var(--mongodb-spring-green)" />
                              line {fn.location.line}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFunctionVisibility(fn.name); }}
                              title="Hide from custom view"
                              style={{
                                background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)',
                                borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                                color: '#ff6b6b', fontSize: '11px', fontWeight: 500,
                                display: 'flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <EyeOff size={12} /> Hide
                            </button>
                          </div>

                          {/* Inputs / Outputs / Calls */}
                          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                            {fn.inputs.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--mongodb-spring-green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', minWidth: '40px' }}>in</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {fn.inputs.map((inp, ii) => (
                                    <span key={ii} style={{
                                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                                      background: 'rgba(0, 237, 100, 0.08)', border: '1px solid rgba(0, 237, 100, 0.2)',
                                      color: 'var(--mongodb-spring-green)', padding: '3px 10px', borderRadius: '6px',
                                    }}>{inp}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {fn.outputs.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: fn.calls?.length > 0 ? '4px' : '0' }}>
                                <span style={{ fontSize: '11px', color: 'var(--mongodb-blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', minWidth: '40px' }}>out</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {fn.outputs.map((out, oi) => (
                                    <span key={oi} style={{
                                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                                      background: 'rgba(1, 107, 248, 0.08)', border: '1px solid rgba(1, 107, 248, 0.2)',
                                      color: 'var(--mongodb-blue)', padding: '3px 10px', borderRadius: '6px',
                                    }}>{out}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {fn.calls?.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--mongodb-yellow)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', minWidth: '40px' }}>calls</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {fn.calls.slice(0, 5).map((call, ci) => (
                                    <span key={ci} style={{
                                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                                      background: 'rgba(255, 221, 0, 0.08)', border: '1px solid rgba(255, 221, 0, 0.2)',
                                      color: 'var(--mongodb-yellow)', padding: '3px 10px', borderRadius: '6px',
                                    }}>{call}</span>
                                  ))}
                                  {fn.calls.length > 5 && (
                                    <span style={{
                                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                                      color: 'var(--mongodb-gray-light-2)', padding: '3px 8px',
                                    }}>+{fn.calls.length - 5} more</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {fn.inputs.length === 0 && fn.outputs.length === 0 && (!fn.calls || fn.calls.length === 0) && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--mongodb-gray-light-2)', fontStyle: 'italic', opacity: 0.6 }}>
                                No metadata resolved for this symbol.
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div className="sidebar">

        {/* Header */}
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1>
              <Zap size={24} fill="var(--mongodb-spring-green)" />
              {workspace ? workspace.split(/[/\\]/).filter(Boolean).pop() : 'GraphHub'}
            </h1>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'var(--mongodb-gray-dark-3)', border: 'none', color: 'var(--mongodb-white)', cursor: 'pointer', padding: '10px', borderRadius: '10px', display: 'flex' }}
              title="Return to Home"
            >
              <Home size={18} />
            </button>
          </div>
          <p>Local Code Intelligence Graph</p>

          {/* View toggle */}
          <div style={{
            display: 'flex', gap: '8px', marginTop: '20px',
            background: 'var(--mongodb-gray-dark-3)', borderRadius: '12px', padding: '6px',
            border: '1px solid var(--mongodb-border)'
          }}>
            {(['graph', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', fontWeight: 700,
                background: view === v ? 'var(--mongodb-spring-green)' : 'transparent',
                color: view === v ? 'var(--mongodb-forest)' : 'var(--mongodb-gray-light-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}>
                {v === 'graph' ? <Code size={14} /> : <List size={14} />}
                {v === 'graph' ? 'Graph' : 'Inventory'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <form className="search-box" onSubmit={handleSearch}>
          <Search size={18} color="var(--mongodb-spring-green)" />
          <input
            placeholder={view === 'list' ? 'Search inventory…' : 'Semantic search…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        {/* Details panel */}
        <div className="details-panel">
          {selectedNode ? (

            /* ── Selected node ─────────────────────────────────────────────── */
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {/* Kind Chip */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`node-chip ${selectedNode.data.type}`}>{selectedNode.data.type}</span>
                <span style={{ fontSize: '12px', color: 'var(--mongodb-gray-light-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {selectedNode.data.kind || 'Symbol'}
                </span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontVariationSettings: '"wght" 700', margin: '0 0 12px 0', lineHeight: 1.2, color: 'var(--mongodb-white)' }}>
                {selectedNode.data.label}
              </h2>

              {/* Location (Always show with fallback) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', fontSize: '14px', color: 'var(--mongodb-gray-light-2)' }}>
                <MapPin size={14} color="var(--mongodb-spring-green)" />
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {symbolDetails?.filePath 
                    ? `${symbolDetails.filePath.replace(/\\/g, '/').split('/').pop()}:${(symbolDetails.range?.start?.row ?? 0) + 1}`
                    : `${selectedNode.data.fileName || 'Unknown File'}:${selectedNode.data.line || '?'}`
                  }
                </span>
              </div>

              {loadingDetails && !symbolDetails && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--mongodb-spring-green)', fontSize: '14px', marginBottom: '24px', background: 'var(--mongodb-gray-dark-3)', padding: '12px', borderRadius: '8px' }}>
                  <Loader size={16} className="animate-spin" /> Resolving dependencies…
                </div>
              )}

              {/* ── Inputs / Outputs ───────────────────────────────────────── */}
              {((symbolDetails?.inputs?.length || 0) > 0 || (symbolDetails?.outputs?.length || 0) > 0 || (selectedNode.data.inputs?.length || 0) > 0 || (selectedNode.data.outputs?.length || 0) > 0) && (
                <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {(symbolDetails?.inputs || selectedNode.data.inputs)?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '11px', color: 'var(--mongodb-gray-light-2)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                        <ArrowRight size={14} color="var(--mongodb-spring-green)" />
                        Inputs
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(symbolDetails?.inputs || selectedNode.data.inputs).map((i: string, idx: number) => (
                          <span key={idx} style={{ background: 'rgba(0, 237, 100, 0.1)', border: '1px solid rgba(0, 237, 100, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--mongodb-spring-green)' }}>
                            {i}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(symbolDetails?.outputs || selectedNode.data.outputs)?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '11px', color: 'var(--mongodb-gray-light-2)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                        <ArrowLeft size={14} color="var(--mongodb-blue)" />
                        Outputs
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(symbolDetails?.outputs || selectedNode.data.outputs).map((o: string, idx: number) => (
                          <span key={idx} style={{ background: 'rgba(1, 107, 248, 0.1)', border: '1px solid rgba(1, 107, 248, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--mongodb-blue)' }}>
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Called by / Calls ──────────────────────────────────────── */}
              {((symbolDetails?.callers?.length || 0) > 0 || (symbolDetails?.callees?.length || 0) > 0 || (selectedNode.data.calls?.length || 0) > 0) && (
                <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {symbolDetails && symbolDetails.callers.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '11px', color: 'var(--mongodb-gray-light-2)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                        <Layers size={14} color="var(--mongodb-spring-green)" />
                        Called by
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {symbolDetails.callers.map((c, idx) => (
                          <div key={idx} style={{ background: 'var(--mongodb-gray-dark-3)', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: '1px solid var(--mongodb-border)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mongodb-gray-light-1)' }}>
                            <ChevronRight size={14} color="var(--mongodb-gray-light-2)" />
                            {c.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(symbolDetails?.callees || (selectedNode.data.calls || [])).length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '11px', color: 'var(--mongodb-gray-light-2)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                        <Zap size={14} color="var(--mongodb-yellow)" />
                        Calls
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(symbolDetails?.callees.map(c => c.name) || selectedNode.data.calls || []).map((name: string, idx: number) => (
                          <div key={idx} style={{ background: 'var(--mongodb-gray-dark-3)', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: '1px solid var(--mongodb-border)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mongodb-gray-light-1)' }}>
                            <ChevronRight size={14} color="var(--mongodb-gray-light-2)" />
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Find Purpose (API key gated) ───────────────────────────── */}
              {selectedNode.data.type === 'Symbol' && (
                <div style={{ marginTop: '24px', border: '1px solid var(--mongodb-border)', borderRadius: '16px', overflow: 'hidden', background: 'var(--mongodb-slate)' }}>

                  {/* Section header */}
                  <div
                    onClick={() => setShowApiKeyInput((v) => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '16px',
                      background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <Lightbulb size={16} color="var(--mongodb-yellow)" />
                    <strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--mongodb-white)', flex: 1 }}>
                      Intelligent Summary
                    </strong>
                    {apiKeyValid === true
                      ? <Unlock size={14} color="var(--mongodb-spring-green)" />
                      : <Lock size={14} color="var(--mongodb-gray-dark-1)" />}
                  </div>

                  {/* Purpose result */}
                  {purposeResult && (
                    <div style={{ padding: '20px', borderTop: '1px solid var(--mongodb-border)' }}>
                      <p style={{ fontSize: '15px', color: 'var(--mongodb-white)', lineHeight: 1.6, margin: '0 0 20px 0', fontWeight: 500 }}>
                        {purposeResult.purpose}
                      </p>
                      {purposeResult.strategy && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Zap size={14} color="var(--mongodb-spring-green)" />
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--mongodb-gray-light-2)', fontWeight: 700 }}>Implementation Strategy</span>
                          </div>
                          <div style={{ padding: '16px', background: 'var(--mongodb-forest)', borderRadius: '12px', border: '1px solid var(--mongodb-border)' }}>
                            <p style={{ fontSize: '14px', color: 'var(--mongodb-gray-light-2)', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-mono)' }}>
                              {purposeResult.strategy}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* API key input */}
                  {(showApiKeyInput || !purposeResult) && (
                    <div style={{ padding: '20px', borderTop: purposeResult ? '1px solid var(--mongodb-border)' : 'none', background: 'rgba(0,0,0,0.1)' }}>
                      {!purposeResult && (
                        <p style={{ fontSize: '13px', color: 'var(--mongodb-gray-light-2)', marginBottom: '16px', lineHeight: 1.5 }}>
                          Leverage GraphHub AI to automatically summarize function behavior. Required: <strong>GRAPHHUB_API_KEY</strong>.
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px', flex: 1,
                          background: 'var(--mongodb-gray-dark-3)',
                          border: `1px solid ${apiKeyValid === false ? 'var(--mongodb-red)' : 'var(--mongodb-border)'}`,
                          borderRadius: '12px', padding: '12px 16px',
                        }}>
                          <Key size={14} color="var(--mongodb-gray-dark-1)" />
                          <input
                            type="password"
                            placeholder="Enter credentials…"
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setApiKeyValid(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleFindPurpose(); }}
                            style={{
                              background: 'transparent', border: 'none', outline: 'none',
                              color: 'var(--mongodb-white)', fontSize: '14px', flex: 1,
                              fontFamily: 'var(--font-mono)',
                            }}
                          />
                        </div>
                        <button
                          onClick={handleFindPurpose}
                          disabled={!apiKey.trim() || purposeLoading}
                          className="btn-primary"
                          style={{
                            padding: '12px 20px',
                            fontSize: '14px',
                            display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
                          }}
                        >
                          {purposeLoading ? <Loader size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                          {purposeLoading ? 'Analyzing' : 'Summarize'}
                        </button>
                      </div>
                      {apiKeyValid === false && (
                        <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', margin: '6px 0 0 0' }}>
                          Invalid API key. Check your key and try again.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : (

            /* ── Default: functions table ─────────────────────────────────── */
            <div>
              {functionsLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--mongodb-gray-light-2)', marginTop: '80px' }}>
                  <Loader size={48} className="animate-spin" style={{ marginBottom: '24px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', fontWeight: 500 }}>Scanning inventory…</p>
                </div>
              ) : functions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mongodb-gray-light-2)', marginTop: '100px' }}>
                  <Code size={64} strokeWidth={1} style={{ marginBottom: '24px', opacity: 0.3 }} />
                  <p style={{ fontSize: '18px', lineHeight: 1.5 }}>
                    No indexed functions yet.<br />Index a codebase to get started.
                  </p>
                </div>
              ) : (
                <>
                  {/* Header with controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--mongodb-gray-light-2)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, margin: 0 }}>
                      {visibleFunctions.length}/{filteredFunctions.length} Functions
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={showAllFunctions} style={{ background: 'var(--mongodb-gray-dark-3)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--mongodb-white)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Eye size={10} /> All
                      </button>
                      <button onClick={hideAllFunctions} style={{ background: 'var(--mongodb-gray-dark-3)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--mongodb-gray-light-2)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <EyeOff size={10} /> None
                      </button>
                      <button onClick={() => setShowSaveModal(true)} disabled={visibleFunctions.length === 0} style={{ background: visibleFunctions.length > 0 ? 'var(--mongodb-spring-green)' : 'var(--mongodb-gray-dark-3)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: visibleFunctions.length > 0 ? 'pointer' : 'not-allowed', color: visibleFunctions.length > 0 ? '#000' : 'var(--mongodb-gray-light-2)', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Download size={10} /> MD
                      </button>
                    </div>
                  </div>

                  {/* Function cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredFunctions.map((fn, i) => {
                      const isHidden = hiddenFunctions.has(fn.name);
                      return (
                        <div
                          key={i}
                          onClick={() => handleFunctionListClick(fn)}
                          style={{
                            background: 'var(--mongodb-slate)', border: '1px solid var(--mongodb-border)',
                            borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.2s',
                            opacity: isHidden ? 0.4 : 1,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--mongodb-spring-green)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--mongodb-border)';
                          }}
                        >
                          {/* Row 1: Symbol, Name, Toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span className="node-chip Symbol" style={{ fontSize: '9px', padding: '2px 6px' }}>{fn.kind}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--mongodb-white)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fn.name}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFunctionVisibility(fn.name); }}
                              style={{
                                background: isHidden ? 'rgba(255,100,100,0.15)' : 'rgba(0,237,100,0.15)',
                                border: `1px solid ${isHidden ? 'rgba(255,100,100,0.3)' : 'rgba(0,237,100,0.3)'}`,
                                borderRadius: '4px', padding: '2px 6px', cursor: 'pointer',
                                color: isHidden ? '#ff6b6b' : 'var(--mongodb-spring-green)',
                                display: 'flex', alignItems: 'center', fontSize: '10px',
                              }}
                            >
                              {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                            </button>
                          </div>

                          {/* Row 2: Location */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--mongodb-gray-light-2)', marginBottom: '8px' }}>
                            <FileCode size={11} color="var(--mongodb-spring-green)" />
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{fn.location.fileName}:{fn.location.line}</span>
                          </div>

                          {/* Row 3: Inputs */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--mongodb-spring-green)', fontWeight: 600, minWidth: '32px' }}>IN</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--mongodb-gray-light-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fn.inputs.length > 0 ? fn.inputs.join(', ') : '—'}
                            </span>
                          </div>

                          {/* Row 4: Outputs */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--mongodb-blue)', fontWeight: 600, minWidth: '32px' }}>OUT</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--mongodb-gray-light-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fn.outputs.length > 0 ? fn.outputs.join(', ') : '—'}
                            </span>
                          </div>

                          {/* Row 5: Calls */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--mongodb-yellow)', fontWeight: 600, minWidth: '32px' }}>CALLS</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--mongodb-gray-light-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fn.calls?.length > 0 ? fn.calls.slice(0, 3).join(', ') + (fn.calls.length > 3 ? '…' : '') : '—'}
                            </span>
                          </div>

                          {/* Row 6: Purpose (placeholder) */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--mongodb-gray-light-2)', fontWeight: 600, minWidth: '32px' }}>DESC</span>
                            <span style={{ fontStyle: 'italic', color: 'var(--mongodb-gray-dark-1)' }}>
                              Click to analyze
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Custom MD Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowSaveModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--mongodb-slate)', borderRadius: '16px', padding: '32px',
              width: '100%', maxWidth: '480px', border: '1px solid var(--mongodb-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--mongodb-spring-green)', padding: '10px', borderRadius: '10px' }}>
                <Save size={20} color="#000" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--mongodb-white)' }}>
                  Save Custom Graph View
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--mongodb-gray-light-2)' }}>
                  Export {visibleFunctions.length} visible functions as markdown
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--mongodb-gray-light-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                File Name
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder="custom-graph"
                  style={{
                    flex: 1, padding: '12px 16px', background: 'var(--mongodb-gray-dark-3)',
                    border: '1px solid var(--mongodb-border)', borderRadius: '8px',
                    color: 'var(--mongodb-white)', fontSize: '15px', fontFamily: 'var(--font-mono)',
                  }}
                />
                <span style={{ color: 'var(--mongodb-gray-light-2)', fontSize: '15px' }}>.md</span>
              </div>
            </div>

            <div style={{ background: 'var(--mongodb-gray-dark-3)', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--mongodb-gray-light-2)', lineHeight: 1.5 }}>
                This will create a markdown file in your project directory with:
              </p>
              <ul style={{ margin: '12px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--mongodb-white)' }}>
                <li>Function tables grouped by file</li>
                <li>Inputs, outputs, and call relationships</li>
                <li>Mermaid diagram of visible call flow</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '12px 20px', background: 'transparent', border: '1px solid var(--mongodb-border)',
                  borderRadius: '8px', color: 'var(--mongodb-white)', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomMd}
                disabled={saving || !customFileName.trim()}
                style={{
                  padding: '12px 20px', background: 'var(--mongodb-spring-green)', border: 'none',
                  borderRadius: '8px', color: '#000', fontSize: '14px', fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {saving ? <Loader size={14} /> : <Download size={14} />}
                {saving ? 'Saving...' : 'Save File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Explorer;
