const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');
const { logAuthAttempt, logSecurityEvent } = require('../utils/logger');

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  algorithms: ['HS256']
}, async (payload, done) => {
  try {
    const user = await User.findByPk(payload.userId);
    
    if (!user) {
      logAuthAttempt('jwt_validation', false, { 
        userId: payload.userId, 
        reason: 'User not found' 
      });
      return done(null, false);
    }

    if (!user.isActive) {
      logAuthAttempt('jwt_validation', false, { 
        userId: user.id, 
        reason: 'User inactive' 
      });
      return done(null, false);
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && payload.iat < parseInt(user.passwordChangedAt.getTime() / 1000, 10)) {
      logAuthAttempt('jwt_validation', false, { 
        userId: user.id, 
        reason: 'Password changed after token issued' 
      });
      return done(null, false);
    }

    return done(null, user);
  } catch (error) {
    logSecurityEvent('jwt_strategy_error', { error: error.message });
    return done(error, false);
  }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findByGoogleId(profile.id);
    
    if (user) {
      // User exists, update profile info if needed
      await user.update({
        profilePicture: profile.photos?.[0]?.value || user.profilePicture,
        lastLogin: new Date()
      });
      
      logAuthAttempt('google_oauth', true, { 
        userId: user.id, 
        googleId: profile.id 
      });
      
      return done(null, user);
    }

    // Check if user exists with same email
    user = await User.findOne({ where: { email: profile.emails[0].value } });
    
    if (user) {
      // Link Google account to existing user
      await user.update({
        googleId: profile.id,
        isVerified: true,
        emailVerifiedAt: new Date(),
        profilePicture: profile.photos?.[0]?.value || user.profilePicture,
        lastLogin: new Date()
      });
      
      logAuthAttempt('google_oauth_link', true, { 
        userId: user.id, 
        googleId: profile.id 
      });
      
      return done(null, user);
    }

    // Create new user
    const newUser = await User.create({
      username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Date.now(),
      email: profile.emails[0].value,
      googleId: profile.id,
      profilePicture: profile.photos?.[0]?.value,
      isVerified: true,
      emailVerifiedAt: new Date(),
      role: 'user',
      lastLogin: new Date()
    });

    logAuthAttempt('google_oauth_signup', true, { 
      userId: newUser.id, 
      googleId: profile.id,
      email: profile.emails[0].value
    });

    return done(null, newUser);
  } catch (error) {
    logSecurityEvent('google_oauth_error', { 
      error: error.message,
      googleId: profile.id 
    });
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;