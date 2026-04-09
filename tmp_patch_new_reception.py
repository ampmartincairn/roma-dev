from pathlib import Path
path = Path(r'c:\Users\solo mid\Desktop\roma-dev\src\pages\NewReceptionRequest.jsx')
text = path.read_text(encoding='utf-8')
old = '      </form>\n    </div>\n  );\n}\n'
new = '      </form>\n    </div>\n  );\n  };\n\n  try {\n    return renderContent();\n  } catch (error) {\n    console.error("NewReceptionRequest render error:", error);\n    return (\n      <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">\n        <h2 className="text-lg font-semibold mb-2">Ошибка рендеринга страницы</h2>\n        <pre className="whitespace-pre-wrap text-sm">{String(error)}</pre>\n      </div>\n    );\n  }\n}\n'
if old not in text:
    raise SystemExit('old not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('patched')
