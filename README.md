# Sourcepad

A multi-document source editor in the browser. Same daily work as Notepad++: tabs, syntax highlighting, find and replace, and a session that stays on this device.

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 8080. Documents are stored in the browser only. There is no account.

## Editing

- New `Ctrl+N`, Open `Ctrl+O`, Save `Ctrl+S`
- Find `Ctrl+F`, Replace `Ctrl+H`, Go to line `Ctrl+G`
- Duplicate line `Ctrl+D`, comment `Ctrl+/`
- Alt-drag for a column selection. Ctrl-click for another cursor.

Chrome and Edge can write a file back to disk. Other browsers download it.
