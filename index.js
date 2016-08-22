"use strict";
require("dotenv").load();
require("dotenv").load({path: "./.env-defaults"});

var express = require("express");
var bodyParser = require("body-parser");
var cookieSession = require("cookie-session");
var request = require("request-promise");

var featureExamples = require("./feature-examples");

var config = {
	socialtables_oauth_authorize_url: process.env.SOCIALTABLES_AUTH_HOST + "/oauth/authorize",
	socialtables_oauth_token_url:     process.env.SOCIALTABLES_AUTH_HOST + "/oauth/token",
	socialtables_v3_api_host:         process.env.SOCIALTABLES_V3_API_HOST,
	socialtables_v4_api_host:         process.env.SOCIALTABLES_V4_API_HOST,
	socialtables_app_id:              process.env.SOCIALTABLES_APP_ID,
	socialtables_app_secret:          process.env.SOCIALTABLES_APP_SECRET,
	oauth_redirect_url:               (process.env.APP_HOST || "http://localhost:3000") + "/oauth/redirect",
	session_key: "secure",

	// these MUST go away (as in be hidden behind a central API) before this is released.
	socialtables_events_api_host:     process.env.SOCIALTABLES_EVENTS_API_HOST,
	socialtables_guestlist_api_host:  process.env.SOCIALTABLES_GUESTLIST_API_HOST
};

// build app, basic middleware
var app = express();
app.use(express.static("public"));
app.use(bodyParser.json());

// configure sessions in which we will store our OAuth bearer token;
// this serves to eliminate the need for a datastore in this example
app.set("trust proxy", 1);
app.use(cookieSession({
  name: "session",
  keys: [config.session_key]
}));

// configure templating engine
app.set("views", "./views");
app.set("view engine", "ejs");

// apply middleware to set the current user based on their OAuth bearer token
app.use(function(req, res, next) {

	req.user = null;

	// if the session contains a token, look it up
	if (req.session.oauth_access_token) {

		var authHeaders = {
			Authorization: `Bearer ${req.session.oauth_access_token}`
		};

		// make a request for user details corresponding to the token
		request({
			method: "GET",
			headers: authHeaders,
			uri: `${config.socialtables_v4_api_host}/oauth/token`,
			json: true
		})
		.then(function(tokenDetails) {

			// look up the user object based on the ID we recieved
			var userID = tokenDetails.id;
			req.userID = tokenDetails.v4_id;
			req.legacyUserID = tokenDetails.legacy_id;
			return request({
				method: "GET",
				headers: authHeaders,
				uri: `${config.socialtables_v4_api_host}/users/${userID}`,
				json: true
			});
		})
		.then(function(userDetails) {

			// apply the user object to the request
			req.user = userDetails;
			next();
		})
		.catch(function(err) {
			console.error("Error getting user details", err);
			next();
		});
	}
	// no token, no problem
	else {
		next();
	}
});

/**
 * Initiates an OAuth authorization_code grant handshake with Social Tables
 */
app.get("/oauth/login-with-socialtables", function(req, res) {

	var oauthAuthorizeURL = config.socialtables_oauth_authorize_url +
		"?client_id=" + encodeURIComponent(config.socialtables_app_id) +
		"&redirect_uri=" + encodeURIComponent(config.oauth_redirect_url) +
		"&grant_type=authorization_code" +
		"&response_type=code";

	res.redirect(oauthAuthorizeURL);
});

/**
 * Handles authorization code redirect from social tables
 */
app.get("/oauth/redirect", function(req, res) {

	// if the response indicated rejection, report the issue to the user
	if (req.query.error || !req.query.code) {
		res.render("error", {
			error: req.query.error_description || "authorization failed"
		});
	}
	// if we have an authorization_code, request an access_token from the API
	else {
		var authorization_code = req.query.code;
		request({
			method: "POST",
			uri: config.socialtables_oauth_token_url,
			form: {
				code: authorization_code,
				client_id: config.socialtables_app_id,
				client_secret: config.socialtables_app_secret,
				grant_type: "authorization_code",
				response_type: "token"
			},
			resolveWithFullResponse: true,
			json: true
		})
		.then(function(tokenResp) {

			// if we got a token back, add it to the active session
			// and redirect to the root url; the user is now authenticated
			if (tokenResp.statusCode === 200) {
				if (tokenResp.body) {
					req.session.oauth_access_token = tokenResp.body.access_token;
					return res.redirect("/");
				}
			}
			return res.render("error", { error: "failed to get an access token" });
		})
		.catch(function(err) {
			res.render("error", { error: "failed to get an access token" });
		});
	}
});

/**
 * Logout simply removes the access_token from the current session
 */
app.get("/logout", function(req, res) {
	delete req.session.oauth_access_token;
	res.redirect("/");
});

/**
 * Landing page - displays user details if they are present
 */
app.get("/", function (req, res) {

	// if the user is not logged in, simply render
	if (!req.user) {
		return res.render("index", { user: req.user, features: null });
	}
	// otherwise, invoke feature examples and render
	else {
		return featureExamples
			.invokeFeatureExamples(config, req)
			.catch(err => {
				return null;
			})
			.then(features => {
				return res.render("index", {
					user: req.user,
					features: features
				})
			})
	}
});

// start server
app.listen(3000, function () {
  console.log("Socialtables example app listening on port 3000.");
});
