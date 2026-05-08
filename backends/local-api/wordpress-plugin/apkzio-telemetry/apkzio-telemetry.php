<?php
/**
 * Plugin Name:       ApkZio Telemetry
 * Description:       Connects this WordPress site to your ApkZio dashboard for install counts, traffic, and subscriber totals.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            ApkZio
 * License:           GPL-2.0-or-later
 * Text Domain:       apkzio-telemetry
 *
 * @package ApkZio_Telemetry
 */

if (!defined('ABSPATH')) {
	exit;
}

define('APKZIO_TELEMETRY_VERSION', '1.0.0');

if (file_exists(__DIR__ . '/apkzio-embedded-config.php')) {
	require_once __DIR__ . '/apkzio-embedded-config.php';
}

/**
 * Normalize site URL the same way the ApkZio API does (origin + path, no trailing slash on path).
 *
 * @param string $url Full URL.
 * @return string
 */
function apkzio_normalize_site_url($url) {
	$parts = wp_parse_url($url);
	if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
		return $url;
	}
	$host = strtolower($parts['host']);
	$path = isset($parts['path']) ? $parts['path'] : '/';
	if ($path !== '/' && substr($path, -1) === '/') {
		$path = rtrim($path, '/') ?: '/';
	}
	$scheme = strtolower($parts['scheme']);
	if ($path === '/') {
		return $scheme . '://' . $host;
	}
	return $scheme . '://' . $host . $path;
}

/**
 * @return int Estimated web-push subscribers (override via filter).
 */
function apkzio_subscribers_total() {
	$estimate = (int) get_option('apkzio_subscribers_estimate', 0);
	return (int) apply_filters('apkzio_subscribers_total', $estimate);
}

/**
 * Increment front-end pageview counter (skipped in admin, AJAX, cron, feeds).
 */
function apkzio_track_pageview() {
	if (is_admin() || wp_doing_ajax() || wp_doing_cron() || (function_exists('wp_is_json_request') && wp_is_json_request())) {
		return;
	}
	if (is_feed() || is_robots() || is_trackback()) {
		return;
	}
	$pv = (int) get_option('apkzio_pv_since_ping', 0);
	update_option('apkzio_pv_since_ping', $pv + 1, false);

	$day = gmdate('Y-m-d');
	$key = 'apkzio_visitors_' . $day;
	$vid = apkzio_visitor_id();
	if ($vid) {
		$seen = get_transient($key);
		if (!is_array($seen)) {
			$seen = array();
		}
		if (!isset($seen[ $vid ])) {
			$seen[ $vid ] = 1;
			set_transient($key, $seen, DAY_IN_SECONDS * 2);
			$uq = (int) get_option('apkzio_uniques_since_ping', 0);
			update_option('apkzio_uniques_since_ping', $uq + 1, false);
		}
	}
}

/**
 * Anonymous visitor id (cookie).
 *
 * @return string
 */
function apkzio_visitor_id() {
	if (!empty($_COOKIE['apkzio_vid'])) {
		return preg_replace('/[^a-f0-9]/', '', strtolower(sanitize_text_field(wp_unslash($_COOKIE['apkzio_vid']))));
	}
	$vid = bin2hex(random_bytes(16));
	if (!headers_sent()) {
		setcookie('apkzio_vid', $vid, time() + YEAR_IN_SECONDS, COOKIEPATH ? COOKIEPATH : '/', COOKIE_DOMAIN, is_ssl(), true);
	}
	return $vid;
}

function apkzio_api_register_url($base) {
	return rtrim($base, '/') . '/api/wp/v1/register';
}

function apkzio_api_telemetry_url($base) {
	return rtrim($base, '/') . '/api/wp/v1/telemetry';
}

function apkzio_send_telemetry() {
	$base = get_option('apkzio_api_base_url', '');
	$site_id = get_option('apkzio_site_id', '');
	$token = get_option('apkzio_site_token', '');
	if ($base === '' || $site_id === '' || $token === '') {
		return;
	}

	$pv = (int) get_option('apkzio_pv_since_ping', 0);
	$uq = (int) get_option('apkzio_uniques_since_ping', 0);

	$body = array(
		'site_id'           => $site_id,
		'pageviews_delta'   => $pv,
		'uniques_delta'     => $uq,
		'subscribers_total' => apkzio_subscribers_total(),
		'wp_version'        => get_bloginfo('version'),
		'plugin_version'    => APKZIO_TELEMETRY_VERSION,
	);

	$res = wp_remote_post(
		apkzio_api_telemetry_url($base),
		array(
			'timeout' => 20,
			'headers' => array(
				'Content-Type' => 'application/json; charset=utf-8',
				'Authorization' => 'Bearer ' . $token,
			),
			'body'    => wp_json_encode($body),
		)
	);

	if (!is_wp_error($res) && wp_remote_retrieve_response_code($res) < 400) {
		update_option('apkzio_pv_since_ping', 0, false);
		update_option('apkzio_uniques_since_ping', 0, false);
	}
}

function apkzio_register_site() {
	$base = isset($_POST['apkzio_api_base_url']) ? esc_url_raw(wp_unslash($_POST['apkzio_api_base_url'])) : '';
	$plugin_id = isset($_POST['apkzio_plugin_id']) ? sanitize_text_field(wp_unslash($_POST['apkzio_plugin_id'])) : '';
	if (isset($_POST['apkzio_subscribers_estimate'])) {
		update_option('apkzio_subscribers_estimate', absint(wp_unslash($_POST['apkzio_subscribers_estimate'])), false);
	}
	if ($base === '' || $plugin_id === '') {
		return new WP_Error('missing', __('API base URL and Plugin ID are required.', 'apkzio-telemetry'));
	}

	$site_url = apkzio_normalize_site_url(home_url('/'));

	$res = wp_remote_post(
		apkzio_api_register_url($base),
		array(
			'timeout' => 20,
			'headers' => array(
				'Content-Type' => 'application/json; charset=utf-8',
			),
			'body'    => wp_json_encode(
				array(
					'plugin_id'      => $plugin_id,
					'site_url'       => $site_url,
					'wp_version'     => get_bloginfo('version'),
					'plugin_version' => APKZIO_TELEMETRY_VERSION,
				)
			),
		)
	);

	if (is_wp_error($res)) {
		return new WP_Error('register', $res->get_error_message());
	}
	$code = wp_remote_retrieve_response_code($res);
	$text = wp_remote_retrieve_body($res);
	$data = json_decode($text, true);
	if ($code < 200 || $code >= 300 || !is_array($data) || empty($data['ok'])) {
		$msg = is_array($data) && isset($data['error']['message']) ? (string) $data['error']['message'] : __('Registration failed', 'apkzio-telemetry');
		return new WP_Error('register', $msg);
	}

	$site = $data['site'];
	$site_token = isset($data['site_token']) ? (string) $data['site_token'] : '';
	if ($site_token === '' || empty($site['id'])) {
		return new WP_Error('register', __('Invalid response from ApkZio API.', 'apkzio-telemetry'));
	}

	update_option('apkzio_api_base_url', $base, false);
	update_option('apkzio_plugin_id', $plugin_id, false);
	update_option('apkzio_site_id', $site['id'], false);
	update_option('apkzio_site_token', $site_token, false);
	update_option('apkzio_pv_since_ping', 0, false);
	update_option('apkzio_uniques_since_ping', 0, false);

	return true;
}

function apkzio_admin_menu() {
	add_options_page(
		__('ApkZio', 'apkzio-telemetry'),
		__('ApkZio', 'apkzio-telemetry'),
		'manage_options',
		'apkzio-telemetry',
		'apkzio_render_settings'
	);
}

function apkzio_render_settings() {
	if (!current_user_can('manage_options')) {
		return;
	}

	if (isset($_POST['apkzio_connect']) && check_admin_referer('apkzio_connect', 'apkzio_nonce')) {
		$result = apkzio_register_site();
		if (is_wp_error($result)) {
			echo '<div class="notice notice-error"><p>' . esc_html($result->get_error_message()) . '</p></div>';
		} else {
			echo '<div class="notice notice-success"><p>' . esc_html__('Site connected to ApkZio. Telemetry will sync on the cron schedule.', 'apkzio-telemetry') . '</p></div>';
		}
	}

	$base = get_option('apkzio_api_base_url', '');
	$plugin_id = get_option('apkzio_plugin_id', '');
	if (defined('APKZIO_EMBEDDED_PLUGIN_ID') && APKZIO_EMBEDDED_PLUGIN_ID !== '' && $plugin_id === '') {
		$plugin_id = APKZIO_EMBEDDED_PLUGIN_ID;
	}
	$site_id = get_option('apkzio_site_id', '');
	$has_token = get_option('apkzio_site_token', '') !== '';
	$subs = (int) get_option('apkzio_subscribers_estimate', 0);

	?>
	<div class="wrap">
		<h1><?php esc_html_e('ApkZio Telemetry', 'apkzio-telemetry'); ?></h1>
		<p><?php esc_html_e('Connect this site to your ApkZio admin dashboard. After connecting, the site appears under Plugins → your product → Connected sites.', 'apkzio-telemetry'); ?></p>

		<form method="post" action="">
			<?php wp_nonce_field('apkzio_connect', 'apkzio_nonce'); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="apkzio_api_base_url"><?php esc_html_e('ApkZio API base URL', 'apkzio-telemetry'); ?></label></th>
					<td>
						<input name="apkzio_api_base_url" id="apkzio_api_base_url" type="url" class="regular-text code" value="<?php echo esc_attr($base); ?>" placeholder="https://api.example.com:8787" required />
						<p class="description"><?php esc_html_e('Root URL of your ApkZio local API (no trailing slash).', 'apkzio-telemetry'); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="apkzio_plugin_id"><?php esc_html_e('Plugin ID (UUID)', 'apkzio-telemetry'); ?></label></th>
					<td>
						<input name="apkzio_plugin_id" id="apkzio_plugin_id" type="text" class="regular-text code" value="<?php echo esc_attr($plugin_id); ?>" pattern="[0-9a-fA-F-]{36}" required />
						<p class="description"><?php esc_html_e('Copy from ApkZio Admin → Plugins → open your product → Plugin id.', 'apkzio-telemetry'); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="apkzio_subscribers_estimate"><?php esc_html_e('Reported subscribers (manual)', 'apkzio-telemetry'); ?></label></th>
					<td>
						<input name="apkzio_subscribers_estimate" id="apkzio_subscribers_estimate" type="number" min="0" step="1" class="small-text" value="<?php echo esc_attr((string) $subs); ?>" />
						<p class="description"><?php esc_html_e('Optional count sent with telemetry until you wire apkzio_subscribers_total filter.', 'apkzio-telemetry'); ?></p>
					</td>
				</tr>
			</table>
			<?php if ($site_id) : ?>
				<p><strong><?php esc_html_e('Site ID:', 'apkzio-telemetry'); ?></strong> <code><?php echo esc_html($site_id); ?></code></p>
				<p class="description"><?php echo $has_token ? esc_html__('Site token is stored securely on this server.', 'apkzio-telemetry') : esc_html__('Missing token — connect again.', 'apkzio-telemetry'); ?></p>
			<?php endif; ?>
			<?php submit_button(__('Connect / reconnect to ApkZio', 'apkzio-telemetry'), 'primary', 'apkzio_connect'); ?>
		</form>
	</div>
	<?php
}

function apkzio_cron_schedules($schedules) {
	$schedules['apkzio_five_minutes'] = array(
		'interval' => 300,
		'display'  => __('Every 5 minutes (ApkZio)', 'apkzio-telemetry'),
	);
	return $schedules;
}

function apkzio_activate() {
	add_option('apkzio_pv_since_ping', 0, '', false);
	if (!wp_next_scheduled('apkzio_telemetry_cron')) {
		wp_schedule_event(time() + 60, 'apkzio_five_minutes', 'apkzio_telemetry_cron');
	}
}

function apkzio_deactivate() {
	wp_clear_scheduled_hook('apkzio_telemetry_cron');
}

add_filter('cron_schedules', 'apkzio_cron_schedules');
add_action('init', 'apkzio_track_pageview');
add_action('admin_menu', 'apkzio_admin_menu');
add_action('apkzio_telemetry_cron', 'apkzio_send_telemetry');

register_activation_hook(__FILE__, 'apkzio_activate');
register_deactivation_hook(__FILE__, 'apkzio_deactivate');
