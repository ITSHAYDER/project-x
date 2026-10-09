# VS Code: Copilot says "Copilot" but shows a Gemini error

Most likely cause: the chat is still sending your prompt to the **Gemini model you added with your own API key**, even though the panel is Copilot Chat. "Copilot Chat" is the interface; the **model** is whatever is selected in the model picker.

1. Open Copilot Chat. Click the **model name** at the top of the chat input (the model picker). Choose one of the built-in Copilot models (the default), not the Gemini one.
2. In the picker choose **Manage Models** (or Command Palette: `Chat: Manage Language Models`). Hide or remove the Gemini entry so it cannot be selected by mistake.
3. If you use Agent mode with a bring-your-own-key model and see "No utility model is configured for 'copilot-utility-small'", add to settings: `"chat.byokUtilityModelDefault": "copilot"`.
4. Read the **exact** error. Typical Gemini ones: 429 / RESOURCE_EXHAUSTED (free-tier rate or daily limit; very long prompts and agent mode burn tokens fast), 404 model not found (the model name was retired), 400 INVALID_ARGUMENT, 503 overloaded. Open View > Output > "GitHub Copilot Chat" for the log.
5. Test your key outside VS Code: `npm run ai:diagnose` in this project (it checks key, model name and a test generation).
6. Long prompts: don't paste the whole spec. Attach the file (`#file`) or paste ONE slice from `docs/slices/` at a time. Smaller prompts also cost fewer tokens on a free tier.
