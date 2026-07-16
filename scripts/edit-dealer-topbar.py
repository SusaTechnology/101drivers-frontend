#!/usr/bin/env python3
"""Edit dealer-dashboard.tsx top navigation bar:
1. Add Help icon (?) between NotificationBell and theme toggle
2. Add Share/Export arrow between theme toggle and Sign Out
3. Increase spacing gap-2 -> gap-2 sm:gap-3
4. Add Help Center + Export CSV entries to the mobile menu
"""
from pathlib import Path

p = Path("/home/z/my-project/101drivers-frontend/src/components/pages/dealer-dashboard.tsx")
text = p.read_text(encoding="utf-8")

# --- 1. Top bar icon cluster ---
# Find the unique block that starts with <NotificationBell /> and ends with the mobile menu button
old_block = (
    '            <Button variant={showMapView ? "default" : "outline"} size="icon" '
    'className={cn("w-10 h-10 rounded-xl", showMapView && "bg-lime-500 text-slate-950")} '
    'onClick={() => setShowMapView(!showMapView)}><Map className="h-5 w-5" /></Button>\n'
    '            <NotificationBell />\n'
    '            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl" '
    'onClick={toggleTheme}>{mounted && theme === \'dark\' ? <Sun className="w-5 h-5" /> : '
    '<Moon className="w-5 h-5" />}</Button>\n'
    '            <Button variant="ghost" size="icon" className="hidden sm:flex w-10 h-10 rounded-xl '
    'text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" '
    'onClick={handleSignOut} title="Sign Out"><LogOut className="w-5 h-5" /></Button>'
)

new_block = (
    '            <Button variant={showMapView ? "default" : "outline"} size="icon" '
    'className={cn("w-10 h-10 rounded-xl", showMapView && "bg-lime-500 text-slate-950")} '
    'onClick={() => setShowMapView(!showMapView)} title="Map view"><Map className="h-5 w-5" /></Button>\n'
    '            <NotificationBell />\n'
    '            <Button asChild variant="ghost" size="icon" className="w-10 h-10 rounded-xl" title="Help">\n'
    '              <Link to="/help-customer"><HelpCircle className="h-5 w-5" /></Link>\n'
    '            </Button>\n'
    '            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl" '
    'onClick={toggleTheme} title="Toggle theme">{mounted && theme === \'dark\' ? <Sun className="w-5 h-5" /> : '
    '<Moon className="w-5 h-5" />}</Button>\n'
    '            <Button variant="ghost" size="icon" className="hidden sm:flex w-10 h-10 rounded-xl" '
    'onClick={handleExportCSV} title="Export CSV"><Share2 className="h-5 w-5" /></Button>\n'
    '            <Button variant="ghost" size="icon" className="hidden sm:flex w-10 h-10 rounded-xl '
    'text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" '
    'onClick={handleSignOut} title="Sign Out"><LogOut className="w-5 h-5" /></Button>'
)

assert old_block in text, "old_block (top bar) not found"
assert text.count(old_block) == 1, f"old_block not unique: {text.count(old_block)} matches"
text = text.replace(old_block, new_block)
print("[OK] Top bar icons updated")

# --- 2. Increase spacing on parent flex ---
# Match: <div className="flex items-center gap-2">\n            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
old_wrapper = (
    '          <div className="flex items-center gap-2">\n'
    '            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">'
)
new_wrapper = (
    '          <div className="flex items-center gap-2 sm:gap-3">\n'
    '            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">'
)
assert old_wrapper in text, "old_wrapper not found"
assert text.count(old_wrapper) == 1, f"old_wrapper not unique: {text.count(old_wrapper)} matches"
text = text.replace(old_wrapper, new_wrapper)
print("[OK] Spacing increased to gap-2 sm:gap-3")

# --- 3. Mobile menu additions ---
old_menu = (
    '              <Button onClick={() => setNotificationSettingsOpen(true)} variant="outline" '
    'className="w-full justify-start p-3 rounded-xl font-bold"><Bell className="h-4 w-4 mr-2" />Notifications</Button>\n'
    '              <Link to="/dealer-drafts" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">'
    '<FileText className="h-4 w-4 inline mr-2" />Drafts</Link>'
)
new_menu = (
    '              <Button onClick={() => setNotificationSettingsOpen(true)} variant="outline" '
    'className="w-full justify-start p-3 rounded-xl font-bold"><Bell className="h-4 w-4 mr-2" />Notifications</Button>\n'
    '              <Link to="/help-customer" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">'
    '<HelpCircle className="h-4 w-4 inline mr-2" />Help Center</Link>\n'
    '              <button onClick={handleExportCSV} className="w-full text-left p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">'
    '<Share2 className="h-4 w-4 inline mr-2" />Export Deliveries (CSV)</button>\n'
    '              <Link to="/dealer-drafts" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">'
    '<FileText className="h-4 w-4 inline mr-2" />Drafts</Link>'
)
assert old_menu in text, "old_menu not found"
assert text.count(old_menu) == 1, f"old_menu not unique: {text.count(old_menu)} matches"
text = text.replace(old_menu, new_menu)
print("[OK] Mobile menu updated with Help Center + Export CSV")

p.write_text(text, encoding="utf-8")
print("\n[DONE] File written successfully")
