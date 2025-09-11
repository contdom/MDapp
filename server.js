const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', require('./routes/tables'));
app.use('/api', require('./routes/rows'));
app.use('/api', require('./routes/csv'));
app.use('/api', require('./routes/backup'));
app.use('/api', require('./routes/psetMatrix'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server su http://localhost:${PORT}`));
