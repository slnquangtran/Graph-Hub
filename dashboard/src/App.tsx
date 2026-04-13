import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import './App.css';
import { Search, Code, FileCode, Layers, BookOpen } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - 75,
      y: nodeWithPosition.y - 25,
    };

    return node;
  });

  return { nodes, edges };
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:9000/api/graph');
      const data = await res.json();
      
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        data.nodes,
        data.edges.map((e: any) => ({
          ...e,
          animated: e.label === 'CALLS',
          style: { stroke: e.label === 'IMPORTS' ? '#3b82f6' : e.label === 'CALLS' ? '#10b981' : '#f59e0b' },
          markerEnd: { type: MarkerType.ArrowClosed, color: e.label === 'IMPORTS' ? '#3b82f6' : e.label === 'CALLS' ? '#10b981' : '#f59e0b' }
        }))
      );
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      console.error('Failed to fetch graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    try {
      const res = await fetch('http://localhost:9000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const results = await res.json();
      
      // Highlight matching nodes
      const highlightedIds = results.map((r: any) => r.symbolName);
      setNodes((nds) => nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          border: highlightedIds.includes(n.label) ? '2px solid #00ffcc' : '1px solid rgba(255,170,0,0.1)',
          boxShadow: highlightedIds.includes(n.label) ? '0 0 15px #00ffcc' : 'none'
        }
      })));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="graph-canvas">
        {loading && <div style={{position: 'absolute', top: '50%', left: '50%', color: '#00ffcc'}}>Loading Graph...</div>}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background color="#1a1a1a" gap={20} />
          <Controls />
          <MiniMap nodeStrokeColor="#00ffcc" nodeColor="#1a1a1a" maskColor="rgba(0,0,0,0.5)" />
        </ReactFlow>
      </div>

      <div className="sidebar">
        <div className="header">
          <h1>GraphHub Explorer</h1>
          <p style={{color: 'var(--text-secondary)', fontSize: '12px'}}>Local Code Intelligence</p>
        </div>

        <form className="search-box" onSubmit={handleSearch}>
          <Search size={18} color="#00ffcc" />
          <input 
            placeholder="Semantic Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="details-panel">
          {selectedNode ? (
            <div>
              <div className={`node-chip ${selectedNode.type}`}>{selectedNode.type}</div>
              <h2 style={{margin: '0 0 10px 0', fontSize: '18px'}}>{selectedNode.label}</h2>
              
              <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                <FileCode size={16} /> <span style={{fontSize: '12px'}}>{selectedNode.properties.path || 'Symbol'}</span>
              </div>

              {selectedNode.properties.doc && (
                <div className="doc-section">
                  <div style={{display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px'}}>
                    <BookOpen size={14} /> <strong>Documentation</strong>
                  </div>
                  {selectedNode.properties.doc}
                </div>
              )}

              {selectedNode.properties.calls && selectedNode.properties.calls.length > 0 && (
                <div style={{marginTop: '20px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px'}}>
                    <Layers size={14} /> <strong>Outbound Calls</strong>
                  </div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px'}}>
                    {selectedNode.properties.calls.map((c: string) => (
                      <span key={c} style={{background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px'}}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{textAlign: 'center', color: 'var(--text-secondary)', marginTop: '50px'}}>
              <Code size={48} style={{opacity: 0.2, marginBottom: '20px'}} />
              <p>Select a node to see its details and dependencies</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
