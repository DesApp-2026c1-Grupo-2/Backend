const jwt = require('jsonwebtoken');

const validarJWT = (req, res, next) => {

  try {

    const authorization = req.header('Authorization');

    if (!authorization) {
      return res.status(401).json({
        message: 'Token requerido'
      });
    }

    // Bearer TOKEN
    const token = authorization.split(' ')[1];

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.usuario = payload;

    next();

  } catch (error) {

    return res.status(401).json({
      message: 'Token inválido'
    });
  }
};

module.exports = validarJWT;