import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import WebKit from 'gi://WebKit?version=6.0';

const home = 'file:///app/share/zryspoty/index.html?externalSpotify=1';
const app = new Gtk.Application({application_id: 'pl.zryspoty.player'});
app.connect('activate', () => {
    if (app.active_window) {
        app.active_window.present();
        return;
    }
    const web = new WebKit.WebView();
    web.get_settings().set_enable_html5_local_storage(true);
    web.connect('decide-policy', (_web, decision, type) => {
        if (type !== WebKit.PolicyDecisionType.NAVIGATION_ACTION &&
            type !== WebKit.PolicyDecisionType.NEW_WINDOW_ACTION) return false;
        const uri = decision.get_navigation_action().get_request().get_uri();
        if (uri === home || uri.startsWith(home + '#')) return false;
        decision.ignore();
        if (/^https:\/\/(open\.spotify\.com|spotify\.link|www\.youtube\.com|music\.youtube\.com)\//.test(uri)) {
            Gio.AppInfo.launch_default_for_uri_async(uri, null, null, (object, result) => {
                try { Gio.AppInfo.launch_default_for_uri_finish(result); }
                catch (error) { logError(error); }
            });
        }
        return true;
    });
    const window = new Gtk.ApplicationWindow({
        application: app, title: 'ZRYSPOTY', default_width: 1150, default_height: 760, child: web,
    });
    web.load_uri(home);
    window.present();
});
app.run([]);
