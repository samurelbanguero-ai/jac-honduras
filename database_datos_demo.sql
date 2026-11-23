-- ============================================================
-- DATOS DE DEMOSTRACIÓN — SOLO PARA DESARROLLO LOCAL
-- ============================================================
-- NUNCA ejecutar este archivo en producción: crea un administrador
-- admin/admin123 y afiliados cuya contraseña es su propia cédula.
-- docker-compose lo carga automáticamente solo en el entorno local.

-- ============================================================
-- DATOS DE PRUEBA
-- ============================================================
-- Nota: La contraseña para estos datos de prueba es la misma cédula (hasheada con bcrypt).
INSERT INTO afiliados (nombres, apellidos, cedula, contrasena, fecha_expedicion, genero, etnia, discapacidad, fecha_afiliacion, telefono, correo)
VALUES
    ('Carlos Andres', 'Munoz Lopez', '1234567890', '$2a$10$nLR1A6LOZ2cqAxbziZPP2eU9FkUsNIyWg4z3Beckh.Ri/GE4sNhlG', '2010-03-15', 'Masculino', 'Mestizo', 'Ninguna', '2024-01-10', '3201234567', 'carlos.munoz@correo.com'),
    ('Maria Fernanda', 'Gomez Torres', '0987654321', '$2a$10$1QsTkPoi1dbS50YyVV5C5.bH9/cWWJlNLLKfV9FJB99Jn1Ypu78bK', '2008-07-22', 'Femenino', 'Afrodescendiente', 'Ninguna', '2024-02-14', '3157654321', 'maria.gomez@correo.com'),
    ('Luis Eduardo', 'Ramos Perez', '1122334455', '$2a$10$S2bZcXOZOxVOdOLYHqZGoudc4Ln3jgpVih4pdI/VcLh2uoo6OHWX6', '2005-11-05', 'Masculino', 'Indigena', 'Visual leve', '2024-03-20', '3009988776', 'luis.ramos@correo.com');

-- ============================================================
-- ADMIN: usuario=admin | contrasena=admin123
-- ============================================================
INSERT INTO admin (usuario, contrasena, nombre)
VALUES ('admin', '$2a$10$.fgL5j4e31HzI23jka/Imee51Xaw4Gp1q3fl5qS/QwkMinMWIt0re', 'Administrador JAC');
