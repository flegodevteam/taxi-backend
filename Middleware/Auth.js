const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';


// Middleware to verify JWT token
// const authenticateToken = (req, res, next) => {
    
//     const token = req.header('Authorization') && req.header('Authorization').split(' ')[1];

//     if (!token) {
//         return res.status(403).send({ error: 'Access denied, please logged in' });
//     }

//     // Verify the token
//     jwt.verify(token, JWT_SECRET, (err, user) => {
//         if (err) {
//             return res.status(403).send({ error: 'Invalid or expired token' });
//         }
//         req.user = user; 
//         next(); 
//     });
// };

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ error: "Unauthorized. Token missing or invalid." });
    }

    const token = authHeader.split(" ")[1];

    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user information to the request object
        req.user = decoded;

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        return res.status(403).send({ error: "Forbidden. Invalid or expired token." });
    }
};


module.exports = {
    authenticateToken
};
