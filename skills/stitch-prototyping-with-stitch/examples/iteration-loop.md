# Iteration Loop Example

This example demonstrates how to move from a vague idea to a polished design using Stitch tools.

1. **User**: "I want a profile page for a travel app."
2. **Action**: Call `mcp_StitchMCP_generate_screen_from_text` with project ID and prompt: *"Profile page for a travel enthusiast. Include a cover photo, profile picture, 'Places Visited' counter, and a grid gallery of travel photos. Tropical theme."*
3. **User**: "Make the 'Places Visited' counter look like a series of stamps."
4. **Action**: Call `mcp_StitchMCP_edit_screens` with the `screenId` and prompt: *"Rewrite the 'Places Visited' section. Instead of plain numbers, use stylized postage stamp icons for each continent visited. Keep the tropical color palette."*
5. **User**: "Give me 3 variations of the header section."
6. **Action**: Call `mcp_StitchMCP_generate_variants` with screen ID and creative options.
