import { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState(null);

  // Change this to your backend IP when deployed
  const API_URL = "http://localhost:3001/weights";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(API_URL);
        console.log("Response:", res);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();

    // Optional: fetch every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Sensor Values</h2>
      {data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

export default App;
