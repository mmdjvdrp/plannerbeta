// api/database.js

module.exports = async (req, res) => {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  const firebaseDbUrl = `https://planner-751c1-default-rtdb.europe-west1.firebasedatabase.app/users/${uid}/plannerData.json`;

  try {
    if (req.method === 'GET') {
      const response = await fetch(firebaseDbUrl);
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      const response = await fetch(firebaseDbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
