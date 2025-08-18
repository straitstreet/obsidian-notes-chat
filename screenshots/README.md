# Screenshots and Assets

This directory contains screenshots and visual assets for the Chat with Notes plugin.

## Screenshot Guidelines

### Required Screenshots
1. **chat-interface.png** - Main chat interface with conversation
2. **settings-providers.png** - Provider configuration screen
3. **budget-tracking.png** - Budget monitoring dashboard
4. **hotkey-demo.gif** - Hotkey usage demonstration
5. **knowledge-search.png** - Knowledge graph search results

### Optional Screenshots
- **mobile-interface.png** - Mobile/tablet interface
- **dark-mode.png** - Dark theme variant
- **provider-selection.png** - Model selection dropdown
- **vault-integration.png** - Integration with vault structure

## Asset Specifications

### Screenshots
- **Format**: PNG for static images, GIF for demonstrations
- **Resolution**: 1920x1080 for desktop, 768x1024 for mobile
- **Compression**: Optimize for web (under 500KB each)
- **Background**: Clean vault with sample content

### Icons
- **plugin-icon.png** - 512x512px plugin icon
- **feature-icons/** - Individual feature illustrations

## Naming Convention
- Use descriptive, lowercase names with hyphens
- Include version suffix for major UI changes
- Group related screenshots with prefixes

Example:
```
chat-interface-v1.0.png
settings-providers-dark.png
demo-hotkey-usage.gif
```

## Taking Screenshots

### Setup
1. Use the generated test vault (`npm run generate-vault`)
2. Configure all providers with demo keys
3. Set up sample conversations
4. Use consistent Obsidian theme (default light/dark)

### Chat Interface Screenshots
- Show a realistic conversation with context from notes
- Include both user queries and AI responses
- Demonstrate different message types (text, code, lists)
- Show token usage and cost information

### Settings Screenshots
- Show provider configuration with masked API keys
- Include budget settings with realistic values
- Demonstrate feature toggles and preferences
- Show hotkey configuration

### Demo GIFs
- Record at 30fps, 2-3 seconds duration
- Show complete workflow from hotkey to response
- Include smooth transitions and realistic typing
- Keep file size under 2MB

## Usage in Documentation
These screenshots will be used in:
- README.md hero section
- GitHub repository social preview
- Obsidian Community Plugin submission
- User documentation and guides
- Marketing materials

## TODO: Screenshots Needed
- [ ] Main chat interface
- [ ] Provider settings page  
- [ ] Budget tracking dashboard
- [ ] Hotkey demonstration
- [ ] Knowledge search results
- [ ] Mobile interface
- [ ] Plugin icon design
- [ ] Feature showcase GIF

## Placeholder Images
Until real screenshots are available, use placeholder images with:
- Correct dimensions
- Plugin branding colors
- Feature descriptions
- Professional appearance