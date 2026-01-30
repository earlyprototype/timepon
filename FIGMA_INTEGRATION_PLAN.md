# Timepon × Figma Integration Plan

## Overview

Extending Timepon to support designers through Figma's official MCP server integration. This would enable design file tracking, component monitoring, and design-to-code workflow automation.

## Figma MCP Server Capabilities

### Available Tools (Official)

1. **`get_design_context`** - Extract design context for layers/selections
   - Supports React + Tailwind by default
   - Customizable to Vue, HTML/CSS, iOS, etc.
   - Returns component structure and styling

2. **`get_variable_defs`** - Retrieve design system variables
   - Colors, spacing, typography
   - Design tokens
   - Theme definitions

3. **`get_code_connect_map`** - Map Figma nodes to code components
   - Links design components to codebase
   - Maintains design-code consistency

4. **`get_screenshot`** - Capture visual snapshots
   - Frame/selection screenshots
   - Visual change tracking

5. **`get_metadata`** - Sparse XML representation
   - Layer structure
   - Component hierarchy

6. **`get_figjam`** - Convert FigJam diagrams to XML
   - Flowcharts, diagrams
   - Process documentation

## Timepon Extension Opportunities

### 1. Design File Tracking (`timepon-figma`)

**Concept:** Track when designers create/modify Figma components, pages, and frames.

**Implementation:**
```javascript
// New Timepon tool: track_figma_changes
{
  "tool": "track_figma_changes",
  "monitors": [
    "component_created",
    "component_modified",
    "page_created",
    "frame_exported",
    "variable_changed"
  ]
}
```

**YAML Output Extension:**
```yaml
design_files:
  # === 🎨 Figma Files
  figma:
    # 🎨 Design System Components
    components.fig:
      created: 19 Jan 2026 10:30 >>(2h ago)<<
      last_modified: 19 Jan 2026 12:15 >>(15m ago)<<
      type: component_library
      components_count: 45
      recent_changes:
        - Button component updated
        - Color tokens modified
        - New Card variant added
      figma_url: https://figma.com/file/abc123
```

### 2. Component Change Detection

**Monitor:**
- New components created
- Existing components modified
- Component variants added
- Design tokens updated

**Use Case:**
```
Designer creates "PrimaryButton" component
→ Timepon detects change
→ Logs to _timepon.yaml
→ AI assistant can reference in code generation
```

### 3. Design-Code Sync Tracking

**Track relationship between:**
- Figma components → React components
- Design tokens → CSS variables
- Frames → Page implementations

**YAML Structure:**
```yaml
design_code_map:
  Button:
    figma_id: "node-123-456"
    code_path: "src/components/Button.tsx"
    last_synced: 19 Jan 2026 11:00
    status: in_sync
  
  ColorTokens:
    figma_id: "var-collection-789"
    code_path: "src/styles/tokens.css"
    last_synced: 18 Jan 2026 14:30
    status: out_of_sync  # Designer changed tokens
```

### 4. Visual Change History

**Track screenshots of major design changes:**
```yaml
visual_history:
  - timestamp: 19 Jan 2026 12:00
    frame: "Homepage Hero"
    screenshot: ".timepon/screenshots/hero-20260119.png"
    changes: "Updated layout, new CTA button"
```

### 5. Design System Audit Tool

**New MCP tool: `audit_design_system`**

Leverage Figma MCP to:
- Find inconsistent component usage
- Detect color/typography drift
- Identify unused components
- Report design token coverage

**Example Query:**
```
AI: "Show me all components created this week"
Timepon: Queries _timepon.yaml design_files section
Returns: List of new Figma components with links
```

## Implementation Architecture

### Option A: Integrated Approach

Extend existing Timepon server with Figma capabilities:

```javascript
// index.js additions
class TimeponServer {
  async initialize() {
    await this.startWatching();          // File watching
    await this.startFigmaMonitoring();   // NEW: Figma monitoring
  }
  
  async startFigmaMonitoring() {
    // Poll Figma API for changes
    // Use Figma MCP server tools
    // Update _timepon.yaml with design changes
  }
}
```

### Option B: Separate Server

Create `timepon-figma` as separate MCP server:

```
_timecop/
├── mcp-server/           # Existing file tracking
└── figma-server/         # NEW: Figma tracking
    ├── index.js
    ├── figma-monitor.js
    └── README.md
```

**Configuration:**
```json
{
  "mcpServers": {
    "timepon": {
      "command": "node",
      "args": ["C:\\timecop\\mcp-server\\index.js"],
      "env": {
        "TIMEPON_WORKSPACE": "${workspaceFolder}"
      }
    },
    "timepon-figma": {
      "command": "node",
      "args": ["C:\\timecop\\figma-server\\index.js"],
      "env": {
        "FIGMA_TOKEN": "${env:FIGMA_ACCESS_TOKEN}",
        "WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

## Technical Requirements

### Prerequisites

1. **Figma Access**
   - Professional, Organization, or Enterprise plan
   - Personal access token
   - File/project access permissions

2. **Figma MCP Server**
   - Remote server connection OR
   - Desktop app integration

3. **Dependencies**
```json
{
  "dependencies": {
    "@figma/rest-api-spec": "latest",
    "figma-api": "^1.11.0",
    "axios": "^1.6.0"
  }
}
```

### Environment Variables

```bash
FIGMA_ACCESS_TOKEN=figd_xxxxx
FIGMA_FILE_KEY=abc123def456
TIMEPON_WORKSPACE=${workspaceFolder}
```

## New MCP Tools for Timepon

### 1. `get_design_changes`

Get recent design file changes:
```javascript
{
  "name": "get_design_changes",
  "description": "Get recent Figma design changes tracked by Timepon",
  "inputSchema": {
    "type": "object",
    "properties": {
      "time_range": {
        "type": "string",
        "description": "Time range: 1h, 24h, 7d, 30d"
      },
      "file_type": {
        "type": "string",
        "enum": ["component", "page", "variable", "all"]
      }
    }
  }
}
```

### 2. `check_design_code_sync`

Check if design and code are in sync:
```javascript
{
  "name": "check_design_code_sync",
  "description": "Check synchronization status between Figma and codebase",
  "inputSchema": {
    "type": "object",
    "properties": {
      "component_name": {
        "type": "string",
        "description": "Component to check"
      }
    }
  }
}
```

### 3. `export_design_snapshot`

Create timestamped design snapshot:
```javascript
{
  "name": "export_design_snapshot",
  "description": "Export current Figma state to Timepon tracking",
  "inputSchema": {
    "type": "object",
    "properties": {
      "include_screenshots": {
        "type": "boolean",
        "default": true
      }
    }
  }
}
```

## Use Cases

### For Designers

1. **Change History**
   - "What components did I create this week?"
   - "Show me when the Button component was last updated"

2. **Design System Management**
   - "Find all places using the old primary color"
   - "List unused components in our library"

3. **Handoff Tracking**
   - "Which designs have been implemented in code?"
   - "Show me designs waiting for developer handoff"

### For Developers

1. **Design-Code Alignment**
   - "Has the Header component design changed since I implemented it?"
   - "Get latest design tokens from Figma"

2. **Component Discovery**
   - "Show me all available button variants in Figma"
   - "Get design specs for the new Card component"

3. **Change Notifications**
   - AI notifies when design system changes
   - Alerts when code-design drift detected

### For Teams

1. **Collaboration Tracking**
   - "What did the design team work on today?"
   - "Show recent design-code sync activity"

2. **Documentation**
   - Auto-generate component documentation from Figma
   - Link design decisions to code implementations

3. **Quality Assurance**
   - Verify all designs have corresponding code
   - Check design system consistency

## Implementation Phases

### Phase 1: Basic Integration (MVP)
- Connect to Figma MCP server
- Track component creation/modification
- Basic YAML output for design files
- Single Figma file support

**Estimated Effort:** 2-3 days

### Phase 2: Enhanced Tracking
- Multiple file support
- Design token monitoring
- Screenshot capture
- Change history

**Estimated Effort:** 3-4 days

### Phase 3: Design-Code Sync
- Component mapping
- Sync status tracking
- Out-of-sync detection
- Auto-update notifications

**Estimated Effort:** 4-5 days

### Phase 4: Advanced Features
- Design system audit tools
- Visual regression tracking
- Team collaboration features
- Custom reporting

**Estimated Effort:** 5-7 days

## Configuration Example

### Workspace Config: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "timepon": {
      "command": "node",
      "args": ["C:\\timecop\\mcp-server\\index.js"],
      "env": {
        "TIMEPON_WORKSPACE": "${workspaceFolder}",
        "ENABLE_FIGMA": "true",
        "FIGMA_ACCESS_TOKEN": "${env:FIGMA_ACCESS_TOKEN}",
        "FIGMA_FILE_KEY": "abc123def456"
      }
    }
  }
}
```

### Environment Variables: `.env`

```bash
FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxx
FIGMA_FILE_KEY=abc123def456789
FIGMA_TEAM_ID=123456789
```

## Data Structure: `_timepon.yaml`

### Extended Format with Figma

```yaml
TIMEPON FILE TRACKING
C:\Users\Fab2\Desktop\AI\MyProject
==========================================================================
Last Updated:     Monday, 19 January 2026 at 14:30:00
Files Tracked:    24
Design Files:     3
Components:       45
==========================================================================

workspace: C:\Users\Fab2\Desktop\AI\MyProject
lastUpdated: '2026-01-19T14:30:00.000Z'
totalFiles: 24

files:
  # === 🏠 Root
  Root:
    # (existing file tracking...)

# === 🎨 Design Files (Figma)
design:
  figma_files:
    # 🎨 Component Library
    design-system:
      file_key: abc123def456
      file_url: https://figma.com/file/abc123def456
      last_modified: 19 Jan 2026 14:15 >>(15m ago)<<
      components:
        - name: Button
          node_id: "1:234"
          variants: [primary, secondary, tertiary]
          last_modified: 19 Jan 2026 12:00
          code_path: src/components/Button.tsx
          sync_status: in_sync
        
        - name: Card
          node_id: "1:567"
          variants: [default, elevated]
          last_modified: 19 Jan 2026 14:15
          code_path: null
          sync_status: not_implemented
      
      variables:
        colors:
          - name: primary
            value: "#0066FF"
            last_modified: 18 Jan 2026
        spacing:
          - name: spacing-md
            value: "16px"
            last_modified: 18 Jan 2026

==========================================================================
End of Timepon tracking data
==========================================================================
```

## Benefits

### For Timepon Users

1. **Complete Project Tracking**
   - Files + Design in one place
   - Unified change history
   - Single source of truth

2. **Design-Code Workflow**
   - Know when designs change
   - Track implementation status
   - Maintain consistency

3. **AI-Powered Insights**
   - Ask questions about design changes
   - Get component usage statistics
   - Detect design-code drift

### For Design Teams

1. **Visibility**
   - Track what designers are working on
   - Monitor design system evolution
   - Document design decisions

2. **Collaboration**
   - Better designer-developer handoff
   - Clear implementation status
   - Reduced communication overhead

3. **Quality**
   - Maintain design system consistency
   - Catch design drift early
   - Ensure all designs get implemented

## Next Steps

1. **Research**
   - Set up Figma MCP server locally
   - Test available tools
   - Understand API limits

2. **Prototype**
   - Basic Figma API integration
   - Simple component tracking
   - Proof of concept YAML output

3. **MVP Development**
   - Implement Phase 1 features
   - Create documentation
   - Test with real Figma files

4. **Beta Testing**
   - Test with design teams
   - Gather feedback
   - Iterate on features

## Resources

- [Figma MCP Server Docs](https://developers.figma.com/docs/figma-mcp-server)
- [Figma REST API](https://www.figma.com/developers/api)
- [MCP Specification](https://modelcontextprotocol.io)
- [Timepon GitHub](https://github.com/earlyprototype/timepon)

## Questions to Explore

1. Should Figma tracking be integrated or separate server?
2. How often to poll Figma for changes?
3. Screenshot storage strategy?
4. Multiple team/project support?
5. Pricing implications for Figma API usage?

---

**Status:** Planning/Research Phase  
**Target:** Extend Timepon to support design workflow tracking  
**Goal:** First-class designer support in development workflow tools
