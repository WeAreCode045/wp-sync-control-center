
=== WP Sync Manager ===
Contributors: code045
Tags: sync, migration, wordpress, development, staging
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WordPress synchronization manager for syncing plugins, themes, database tables, and media between environments.

== Description ==

WP Sync Manager is a WordPress plugin that enables synchronization of plugins, themes, database tables, and media files between different WordPress environments (development, staging, live).

= Features =

* Sync plugins between environments
* Sync themes between environments  
* Sync database tables between environments
* Sync media files between environments
* REST API endpoints for external integration
* Simple admin interface
* Secure authentication required

= REST API Endpoints =

* `GET /wp-json/wp-sync-manager/v1/data` - Get WordPress data (plugins, themes, tables, media count)
* `POST /wp-json/wp-sync-manager/v1/sync` - Execute sync operation
* `GET /wp-json/wp-sync-manager/v1/status` - Get sync status

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/wp-sync-manager` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Use the Tools → Sync Manager screen to view plugin information
4. Use your external sync tool to communicate with the REST API endpoints

== Frequently Asked Questions ==

= Does this plugin work automatically? =

No, this plugin provides REST API endpoints that need to be called by an external sync management tool.

= Is authentication required? =

Yes, all REST API endpoints require administrator-level authentication.

= Can I sync between any WordPress sites? =

Yes, as long as this plugin is installed on both source and target sites.

== Changelog ==

= 1.0.0 =
* Initial release
* REST API endpoints for sync operations
* Support for plugins, themes, database, and media sync
* Admin interface for monitoring

== Upgrade Notice ==

= 1.0.0 =
Initial release of WP Sync Manager.
