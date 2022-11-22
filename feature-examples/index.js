"use strict";

let getEnabledFeatures = require("./enabled-features").getEnabledFeatures;
let getNextEventWithTables = require("./tables");
let getUpcomingGuestEvents = require("./guestlists");

module.exports = { invokeFeatureExamples };

/**
 * Invocation helper for feature examples
 */
function invokeFeatureExamples(config, req) {

	let result = {
		access: {},
		data: {},
		error: {}
	};

	// if the user is not logged in, there's not a lot we can do
	if (!req.user) {
		return result;
	}
	else {
		// see what's enabled for the current user
		return getEnabledFeatures(
			config,
			req.legacyUserID,
			req.session.oauth_access_token
		)
		.catch(err => {
			result.error.features = "unable to get enabled features";
			return {};
		})
		// based on that, make subsequent queries
		.then(enabledFeaturesResult => {

			let teamID = enabledFeaturesResult.legacyTeamID;
			let enabledFeatures = enabledFeaturesResult.enabledFeatures || {};
			result.access = enabledFeatures;

			let featureHandlers = [];
			if (enabledFeatures.venueMapper) {
				featureHandlers.push(
					getNextEventWithTables(
						config,
						teamID,
						req.legacyUserID,
						req.session.oauth_access_token
					)
					.then(data => {
						result.data.tables = data;
					})
					.catch(err => {
						result.error.tables = err.message;
					})
				);
			}
			if (enabledFeatures.guest) {
				featureHandlers.push(
					getUpcomingGuestEvents(
						config,
						req.userID,
						req.session.oauth_access_token
					)
					.then(data => {
						result.data.guest = data;
					})
					.catch(err => {
						console.log(err);
						result.error.guest = err.message;
					})
				)
			}
			return Promise.all(featureHandlers);
		})
		.then(() => {
			return result;
		});
	}
}
