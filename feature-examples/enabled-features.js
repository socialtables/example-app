"use strict";
let request = require("request-promise");

module.exports = { getEnabledFeatures };

/**
 * Socialtables users can have access to AM3, VM3, neither, or both.
 * this example demonstrates how developers can detect which features
 * a user has access to.
 *
 * Currently, feature flagging is gated by teams using the legacy V3 API.
 * The flow for this example will be as follows:
 *
 * - make a request for the user's details to obtain their team ID
 * - make a request to the feature flag lookup endpoint to ascertain whether
 *   they have access to AM3, VM3, or both
 *
 * @param config: a configuration object containing API host URLs
 * @param legacyUserID: the legacy playform user ID of the user in question
 * @param oauthToken: the OAuth bearer token for the user
 * @return a promise resolving a map (feature => boolean)
 *         reflecting the user's access. keys:
 *         - guest       (attendee manager 3)
 *         - venueMapper (venue mapper 3)
 */
function getEnabledFeatures(config, legacyUserID, oauthToken) {

	let authHeaders = { Authorization: `Bearer ${oauthToken}` };
	let legacyTeamID = null;

	return request({
		method: "GET",
		headers: authHeaders,
		uri: `${config.socialtables_api_host}/4.0/legacyvm3/users/${legacyUserID}`,
		json: true
	})
	.then(function (legacyUserResponse){
		legacyTeamID = legacyUserResponse.data.team_id;
		return request({
			method: "GET",
			headers: authHeaders,
			uri: `${config.socialtables_api_host}/4.0/legacyvm3/teams/${legacyTeamID}/features`,
			json: true
		})
	})
	.then(function (featureFlagMapResponse) {
		let vm3Feature = featureFlagMapResponse.data["venue-mapper-3"];
		let am3Feature = featureFlagMapResponse.data["attendee-manager-3"];
		let now = new Date();
		let enabledFeatures = {
			guest: false,
			venueMapper: false
		};
		if (vm3Feature && vm3Feature.start_date && vm3Feature.end_date) {
			if (( new Date(vm3Feature.start_date) <= now ) &&
				( new Date(vm3Feature.end_date)   >  now )) {
					enabledFeatures.venueMapper = true;
			}
		}
		if (am3Feature && am3Feature.start_date && am3Feature.end_date) {
			if (( new Date(am3Feature.start_date) <= now ) &&
				( new Date(am3Feature.end_date)   >  now )) {
					enabledFeatures.guest = true;
			}
		}
		return { enabledFeatures, legacyTeamID };
	});
}
