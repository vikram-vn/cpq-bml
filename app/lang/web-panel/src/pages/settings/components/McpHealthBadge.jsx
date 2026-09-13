import React from 'react';
import './McpHealthBadge.css';

/**
 * Badge indicating MCP server health status.
 * @param {Object} props
 * @param {boolean} props.healthy - true if the MCP server is enabled/healthy.
 */
export default function McpHealthBadge({ healthy }) {
  const status = healthy ? 'Running' : 'Disabled';
  const className = healthy ? 'mcp-badge healthy' : 'mcp-badge disabled';
  return (
    <span className={className} role="status" aria-label={`MCP server ${status}`}>MCP: {status}</span>
  );
}
