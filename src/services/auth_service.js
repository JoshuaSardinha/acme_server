'use strict';

const axios = require('axios');
const db = require('../models');
const User = db.User;
let managementApiToken = null;
let tokenExpirationTime = 0;
const config = require('../../config/config.json');
const environment = process.env.NODE_ENV || 'development';

const envConfig = config[environment];

const authService = {
  createUser: async (firstName, lastName, email, auth0UserId) => {
    try {
      const user = await User.create({
        first_name: firstName,
        last_name: lastName,
        email,
        auth0_user_id: auth0UserId,
      });
      return user;
    } catch (error) {
      throw error;
    }
  },

  findUserByEmail: async (email) => {
    try {
      const user = await User.findOne({ where: { email } });
      return user;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  },

  findUserById: async (userId) => {
    try {
      const user = await User.findOne({ where: { id: userId } });
      return user;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  },

  findUserByAuth0Id: async (auth0UserId) => {
    try {
      const user = await User.findOne({ where: { auth0_user_id: auth0UserId } });
      return user;
    } catch (error) {
      console.error('Error finding user by Auth0 ID:', error);
      throw error;
    }
  },

  getManagementApiToken: async () => {
    // Check if token exists and is still valid
    if (managementApiToken && Date.now() < tokenExpirationTime) {
      return managementApiToken;
    }

    try {
      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: envConfig.auth0ManagementClientId,
          client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
          audience: envConfig.auth0ManagementAudience,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      managementApiToken = auth0Response.data.access_token;
      tokenExpirationTime = Date.now() + (auth0Response.data.expires_in - 60) * 1000;

      return managementApiToken;
    } catch (error) {
      if (error.response) {
        console.error('Error getting Management API token:', error.response.data);
        throw {
          response: {
            status: error.response.status,
            data: error.response.data,
          },
        };
      }
      throw error;
    }
  },

  signUpWithAuth0: async ({ firstName, lastName, email, password }) => {
    try {
      const token = await authService.getManagementApiToken();
      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/api/v2/users`,
        {
          connection: 'NationalNiner-DB',
          email,
          password,
          user_metadata: {
            firstName,
            lastName,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return auth0Response;
    } catch (error) {
      if (error.response) {
        console.error('Error signing up with Auth0:', error.response.data);
        throw {
          response: {
            status: error.response.status,
            data: error.response.data,
          },
        };
      }
      throw error;
    }
  },

  loginWithAuth0: async ({ email, password }) => {
    try {
      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/oauth/token`,
        {
          grant_type: 'password',
          username: email,
          password,
          audience: envConfig.apiAudience,
          client_id: envConfig.auth0ClientId,
          client_secret: process.env.AUTH0_CLIENT_SECRET,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return auth0Response;
    } catch (error) {
      console.error('Error logging in with Auth0:', error.response.data);
      throw error;
    }
  },

  refreshWithAuth0: async (refreshToken) => {
    try {
      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/oauth/token`,
        {
          grant_type: 'refresh_token',
          client_id: envConfig.auth0ClientId,
          client_secret: process.env.AUTH0_CLIENT_SECRET,
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return auth0Response;
    } catch (error) {
      console.error('Error refreshing token with Auth0:', error.response.data);
      throw error;
    }
  },
};

module.exports = authService;
