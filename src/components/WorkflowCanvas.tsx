import React, { useState, useRef, useCallback } from 'react';
import { Workflow, WorkflowNode, WorkflowNodeType, Connection } from '../types/workflow';
import './WorkflowCanvas.css';

interface WorkflowCanvasProps {
    workflow: Workflow;
    onUpdate: (workflow: Workflow) => void;
    onBack: () => void;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
    workflow,
    onUpdate,
    onBack
}) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [draggedNode, setDraggedNode] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [showNodePanel, setShowNodePanel] = useState(false);
    const [newNodeType, setNewNodeType] = useState<WorkflowNodeType>('process');

    // Zoom and pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Connection state
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStart, setConnectionStart] = useState<{ nodeId: string; port: string } | null>(null);
    const [tempConnection, setTempConnection] = useState<{ x: number; y: number } | null>(null);

    const nodeTypes = [
        { type: 'input' as WorkflowNodeType, icon: '📥', label: 'Input', color: '#27ae60' },
        { type: 'process' as WorkflowNodeType, icon: '⚙️', label: 'Process', color: '#3498db' },
        { type: 'condition' as WorkflowNodeType, icon: '🔀', label: 'Condition', color: '#f39c12' },
        { type: 'output' as WorkflowNodeType, icon: '📤', label: 'Output', color: '#e91e63' }
    ];

    const getNodeTypeInfo = (type: WorkflowNodeType) => {
        return nodeTypes.find(nt => nt.type === type) || nodeTypes[1];
    };

    // Zoom and pan handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
        setZoom(newZoom);
    }, [zoom]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === canvasRef.current || e.target === svgRef.current) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            setSelectedNode(null);
        }
    }, [pan]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }

        // Handle temporary connection line
        if (isConnecting && tempConnection) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                setTempConnection({
                    x: (e.clientX - rect.left - pan.x) / zoom,
                    y: (e.clientY - rect.top - pan.y) / zoom
                });
            }
        }
    }, [isPanning, panStart, isConnecting, tempConnection, pan, zoom]);

    const handleCanvasMouseUp = useCallback(() => {
        setIsPanning(false);
        if (isConnecting) {
            setIsConnecting(false);
            setConnectionStart(null);
            setTempConnection(null);
        }
    }, [isConnecting]);

    // Connection handlers
    const handleConnectionStart = (nodeId: string, port: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConnecting(true);
        setConnectionStart({ nodeId, port });

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setTempConnection({
                x: (e.clientX - rect.left - pan.x) / zoom,
                y: (e.clientY - rect.top - pan.y) / zoom
            });
        }
    };

    const handleConnectionEnd = (targetNodeId: string, targetPort: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (isConnecting && connectionStart && connectionStart.nodeId !== targetNodeId) {
            const newConnection: Connection = {
                sourceNodeId: connectionStart.nodeId,
                targetNodeId: targetNodeId,
                sourcePort: connectionStart.port,
                targetPort: targetPort
            };

            // Check if connection already exists
            const connectionExists = workflow.connections.some(conn =>
                conn.sourceNodeId === newConnection.sourceNodeId &&
                conn.targetNodeId === newConnection.targetNodeId &&
                conn.sourcePort === newConnection.sourcePort &&
                conn.targetPort === newConnection.targetPort
            );

            if (!connectionExists) {
                const updatedWorkflow = {
                    ...workflow,
                    connections: [...workflow.connections, newConnection]
                };
                onUpdate(updatedWorkflow);
            }
        }

        setIsConnecting(false);
        setConnectionStart(null);
        setTempConnection(null);
    };

    const handleDeleteConnection = (connection: Connection) => {
        const updatedWorkflow = {
            ...workflow,
            connections: workflow.connections.filter(c =>
                !(c.sourceNodeId === connection.sourceNodeId &&
                    c.targetNodeId === connection.targetNodeId &&
                    c.sourcePort === connection.sourcePort &&
                    c.targetPort === connection.targetPort)
            )
        };
        onUpdate(updatedWorkflow);
    };

    const handleAddNode = () => {
        const newNode: WorkflowNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: newNodeType,
            position: { x: 200, y: 200 },
            config: {
                prompt: newNodeType === 'process' ? 'Enter your prompt here...' : undefined,
                condition: newNodeType === 'condition' ? 'Enter condition logic...' : undefined,
                agentRole: newNodeType === 'process' ? 'general' : undefined
            },
            inputs: [],
            outputs: []
        };

        const updatedWorkflow = {
            ...workflow,
            nodes: [...workflow.nodes, newNode]
        };

        onUpdate(updatedWorkflow);
        setShowNodePanel(false);
        setSelectedNode(newNode.id);
    };

    const handleDeleteNode = (nodeId: string) => {
        if (confirm('Are you sure you want to delete this node?')) {
            const updatedWorkflow = {
                ...workflow,
                nodes: workflow.nodes.filter(n => n.id !== nodeId),
                connections: workflow.connections.filter(c =>
                    c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
                )
            };
            onUpdate(updatedWorkflow);
            setSelectedNode(null);
        }
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        setDraggedNode(nodeId);
        setDragOffset({
            x: ((e.clientX - rect.left - pan.x) / zoom) - node.position.x,
            y: ((e.clientY - rect.top - pan.y) / zoom) - node.position.y
        });
        setSelectedNode(nodeId);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggedNode || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const newX = ((e.clientX - rect.left - pan.x) / zoom) - dragOffset.x;
        const newY = ((e.clientY - rect.top - pan.y) / zoom) - dragOffset.y;

        const updatedWorkflow = {
            ...workflow,
            nodes: workflow.nodes.map(node =>
                node.id === draggedNode
                    ? { ...node, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
                    : node
            )
        };

        onUpdate(updatedWorkflow);
    };

    const handleMouseUp = () => {
        setDraggedNode(null);
        setDragOffset({ x: 0, y: 0 });
    };

    const handleUpdateNodeConfig = (nodeId: string, config: any) => {
        const updatedWorkflow = {
            ...workflow,
            nodes: workflow.nodes.map(node =>
                node.id === nodeId ? { ...node, config: { ...node.config, ...config } } : node
            )
        };
        onUpdate(updatedWorkflow);
    };

    const selectedNodeData = selectedNode ? workflow.nodes.find(n => n.id === selectedNode) : null;

    return (
        <div className="workflow-canvas-container">
            <div className="workflow-canvas-header">
                <div className="header-left">
                    <button className="back-btn" onClick={onBack}>
                        ← Back to List
                    </button>
                    <h3>{workflow.name}</h3>
                    <span className="workflow-status">{workflow.status}</span>
                </div>
                <div className="header-actions">
                    <div className="zoom-controls">
                        <button
                            className="zoom-btn"
                            onClick={() => setZoom(Math.max(0.1, zoom * 0.9))}
                            disabled={zoom <= 0.1}
                        >
                            −
                        </button>
                        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                        <button
                            className="zoom-btn"
                            onClick={() => setZoom(Math.min(3, zoom * 1.1))}
                            disabled={zoom >= 3}
                        >
                            +
                        </button>
                        <button
                            className="zoom-reset-btn"
                            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                        >
                            Reset
                        </button>
                    </div>
                    <button
                        className="add-node-btn"
                        onClick={() => setShowNodePanel(true)}
                    >
                        + Add Node
                    </button>
                    <button className="validate-btn">
                        ✓ Validate
                    </button>
                    <button className="run-btn" disabled={workflow.status === 'running'}>
                        ▶️ Run
                    </button>
                </div>
            </div>

            <div className="workflow-canvas-content">
                <div
                    ref={canvasRef}
                    className="canvas"
                    onWheel={handleWheel}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={(e) => {
                        handleCanvasMouseMove(e);
                        handleMouseMove(e);
                    }}
                    onMouseUp={() => {
                        handleCanvasMouseUp();
                        handleMouseUp();
                    }}
                    onMouseLeave={() => {
                        handleCanvasMouseUp();
                        handleMouseUp();
                    }}
                >
                    <div
                        className="canvas-content"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: '0 0'
                        }}
                    >
                        {/* Render connections */}
                        <svg
                            ref={svgRef}
                            className="connections-layer"
                            style={{
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                                top: 0,
                                left: 0
                            }}
                        >
                            {workflow.connections.map((connection, index) => {
                                const sourceNode = workflow.nodes.find(n => n.id === connection.sourceNodeId);
                                const targetNode = workflow.nodes.find(n => n.id === connection.targetNodeId);

                                if (!sourceNode || !targetNode) return null;

                                const startX = sourceNode.position.x + 200;
                                const startY = sourceNode.position.y + 40;
                                const endX = targetNode.position.x;
                                const endY = targetNode.position.y + 40;

                                // Calculate control points for curved connection
                                const controlX1 = startX + 50;
                                const controlY1 = startY;
                                const controlX2 = endX - 50;
                                const controlY2 = endY;

                                const pathData = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

                                return (
                                    <g key={`connection-${index}`}>
                                        <path
                                            d={pathData}
                                            stroke="#3498db"
                                            strokeWidth="2"
                                            fill="none"
                                            markerEnd="url(#arrowhead)"
                                            className="connection-path"
                                            onClick={() => handleDeleteConnection(connection)}
                                        />
                                        {/* Invisible wider path for easier clicking */}
                                        <path
                                            d={pathData}
                                            stroke="transparent"
                                            strokeWidth="10"
                                            fill="none"
                                            className="connection-hitbox"
                                            onClick={() => handleDeleteConnection(connection)}
                                        />
                                    </g>
                                );
                            })}

                            {/* Temporary connection line */}
                            {isConnecting && connectionStart && tempConnection && (
                                (() => {
                                    const sourceNode = workflow.nodes.find(n => n.id === connectionStart.nodeId);
                                    if (!sourceNode) return null;

                                    const startX = sourceNode.position.x + 200;
                                    const startY = sourceNode.position.y + 40;

                                    return (
                                        <line
                                            x1={startX}
                                            y1={startY}
                                            x2={tempConnection.x}
                                            y2={tempConnection.y}
                                            stroke="#3498db"
                                            strokeWidth="2"
                                            strokeDasharray="5,5"
                                            opacity="0.7"
                                        />
                                    );
                                })()
                            )}

                            <defs>
                                <marker
                                    id="arrowhead"
                                    markerWidth="10"
                                    markerHeight="7"
                                    refX="9"
                                    refY="3.5"
                                    orient="auto"
                                >
                                    <polygon
                                        points="0 0, 10 3.5, 0 7"
                                        fill="#3498db"
                                    />
                                </marker>
                            </defs>
                        </svg>

                        {/* Render nodes */}
                        {workflow.nodes.map(node => {
                            const nodeTypeInfo = getNodeTypeInfo(node.type);
                            return (
                                <div
                                    key={node.id}
                                    className={`workflow-node ${node.type} ${selectedNode === node.id ? 'selected' : ''}`}
                                    style={{
                                        left: node.position.x,
                                        top: node.position.y,
                                        borderColor: nodeTypeInfo.color
                                    }}
                                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                >
                                    <div className="node-header">
                                        <span className="node-icon">{nodeTypeInfo.icon}</span>
                                        <span className="node-type">{nodeTypeInfo.label}</span>
                                        <button
                                            className="delete-node-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteNode(node.id);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="node-content">
                                        {node.config.prompt && (
                                            <div className="node-prompt">
                                                {node.config.prompt.substring(0, 50)}
                                                {node.config.prompt.length > 50 ? '...' : ''}
                                            </div>
                                        )}
                                        {node.config.condition && (
                                            <div className="node-condition">
                                                {node.config.condition.substring(0, 50)}
                                                {node.config.condition.length > 50 ? '...' : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* Connection ports */}
                                    <div className="node-ports">
                                        {/* Input port */}
                                        {node.type !== 'input' && (
                                            <div
                                                className="port input-port"
                                                onMouseUp={(e) => handleConnectionEnd(node.id, 'input', e)}
                                            />
                                        )}

                                        {/* Output port */}
                                        {node.type !== 'output' && (
                                            <div
                                                className="port output-port"
                                                onMouseDown={(e) => handleConnectionStart(node.id, 'output', e)}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {workflow.nodes.length === 0 && (
                            <div className="empty-canvas">
                                <div className="empty-canvas-content">
                                    <h4>Empty Workflow</h4>
                                    <p>Add nodes to start building your workflow</p>
                                    <button
                                        className="add-first-node-btn"
                                        onClick={() => setShowNodePanel(true)}
                                    >
                                        Add First Node
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Node Properties Panel */}
                {selectedNodeData && (
                    <div className="node-properties-panel">
                        <h4>Node Properties</h4>
                        <div className="property-group">
                            <label>Type:</label>
                            <span>{getNodeTypeInfo(selectedNodeData.type).label}</span>
                        </div>

                        {selectedNodeData.type === 'process' && (
                            <div className="property-group">
                                <label>Prompt:</label>
                                <textarea
                                    value={selectedNodeData.config.prompt || ''}
                                    onChange={(e) => handleUpdateNodeConfig(selectedNodeData.id, { prompt: e.target.value })}
                                    rows={4}
                                />
                            </div>
                        )}

                        {selectedNodeData.type === 'condition' && (
                            <div className="property-group">
                                <label>Condition:</label>
                                <textarea
                                    value={selectedNodeData.config.condition || ''}
                                    onChange={(e) => handleUpdateNodeConfig(selectedNodeData.id, { condition: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        )}

                        {selectedNodeData.type === 'process' && (
                            <div className="property-group">
                                <label>Agent Role:</label>
                                <select
                                    value={selectedNodeData.config.agentRole || 'general'}
                                    onChange={(e) => handleUpdateNodeConfig(selectedNodeData.id, { agentRole: e.target.value })}
                                >
                                    <option value="general">General</option>
                                    <option value="analyst">Data Analyst</option>
                                    <option value="writer">Content Writer</option>
                                    <option value="reviewer">Code Reviewer</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Node Panel */}
            {showNodePanel && (
                <div className="modal-overlay" onClick={() => setShowNodePanel(false)}>
                    <div className="add-node-panel" onClick={(e) => e.stopPropagation()}>
                        <h4>Add New Node</h4>
                        <div className="node-type-selection">
                            {nodeTypes.map(nodeType => (
                                <button
                                    key={nodeType.type}
                                    className={`node-type-btn ${newNodeType === nodeType.type ? 'selected' : ''}`}
                                    onClick={() => setNewNodeType(nodeType.type)}
                                    style={{ borderColor: nodeType.color }}
                                >
                                    <span className="node-type-icon">{nodeType.icon}</span>
                                    <span className="node-type-label">{nodeType.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="panel-actions">
                            <button className="cancel-btn" onClick={() => setShowNodePanel(false)}>
                                Cancel
                            </button>
                            <button className="add-btn" onClick={handleAddNode}>
                                Add Node
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowCanvas;