import { Router } from 'express';
import { createSugerencia, getSugerencias, updateSugerencia, deleteSugerencia } from '../controllers/sugerenciaRecurso.controller.js';
import { validate } from '../middlewares/validator.middleware.js';
import { sugerenciaRecursoSchema } from '../schemas/sugerenciaRecursoSchema.js';

const router = Router();

router.get('/', getSugerencias);
router.post('/', validate(sugerenciaRecursoSchema), createSugerencia);
router.put('/:id', validate(sugerenciaRecursoSchema), updateSugerencia);
router.delete('/:id', deleteSugerencia);

export default router;