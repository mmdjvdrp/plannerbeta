// api/database.js

export default async function handler(req, res) {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  // آدرس دیتابیس فایربیس شما
  const firebaseDbUrl = `https://planner-751c1-default-rtdb.europe-west1.firebasedatabase.app/users/${uid}/plannerData.json`;

  try {
    // حالت لود اطلاعات (GET)
    if (req.method === 'GET') {
      const response = await fetch(firebaseDbUrl);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // حالت ذخیره اطلاعات (PUT)
    if (req.method === 'PUT') {
      const response = await fetch(firebaseDbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
