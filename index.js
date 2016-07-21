"use strict";
require("dotenv").load();  // read .env, which is .gitignored

var bodyParser = require("body-parser");
var cookieSession = require("cookie-session");
var express = require("express");
var request = require("request-promise");

var config = {
	socialtables_oauth_authorize_url: "http://localhost:2477/oauth/authorize",
	socialtables_oauth_token_url: "http://localhost:2477/oauth/token",
	socialtables_v3_api_host: "http://localhost:8737",
	socialtables_app_id: process.env.SOCIALTABLES_APP_ID,
	socialtables_app_secret: process.env.SOCIALTABLES_APP_SECRET,
	oauth_redirect_url: "http://localhost:3000/oauth/redirect",
	session_key: "secure"
};

var app = express();
app.use(express.static("public"));
app.use(bodyParser.json());

// configure dead-simple sessions
app.set("trust proxy", 1);
app.use(cookieSession({
  name: "session",
  keys: [config.session_key]
}));

// configure templating engine
app.set("views", "./views");
app.set("view engine", "ejs");

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
		var error_description = req.query.error_description || "authorization failed";
		res.render("index", {
			alert: error_description
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
			return res.render("index", {
				alert: "failed to get an access token"
			});
		})
		.catch(function(err) {
			console.error("unable to complete request to Socialtables API", err);
			process.exit(1);
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
 * Landing page
 */
app.get("/", function (req, res) {

	// if we're authenticated, use the API to display user details
	var pageVars = {
		user: null
	};
	var nextStep = Promise.resolve();
	var oauthToken = req.session.oauth_access_token;
	if (oauthToken) {

		// look up the current OAuth bearer token's details
		nextStep = request({
			headers: {
				Authorization: `Bearer ${oauthToken}`
			},
			method: "GET",
			uri: `${config.socialtables_v3_api_host}/oauth/token`,
			json: true
		})
		.then(function(tokenDetails) {

			// using the user ID fetched from the token details endpoint,
			// get the full user
			var userID = tokenDetails.id;
			return request({
				headers: {
					Authorization: `Bearer ${oauthToken}`
				},
				method: "GET",
				uri: `${config.socialtables_v3_api_host}/users/${userID}`,
				json: true
			});
		})
		.then(function(userDetails) {
			pageVars.user = userDetails;
		})
		.catch(function(err) {
			console.error("unable to get user details", err);
			process.exit();
		});
	}

	// render the index page after the user request (or blank Promise) resolves.
	nextStep.then(function() {
		res.render("index", pageVars);
	})
});

// start server
app.listen(3000, function () {
  console.log("Socialtables example app listening on port 3000.");
});
