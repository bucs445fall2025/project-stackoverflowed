import { useEffect, useState } from 'react';

export default function Products() {
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://project-stackoverflowed-production.up.railway.app/spapi/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading products...</p>;
  if (!products || !products.payload) return <p>No products found.</p>;

  return (
    <div>
      <h2>Your Products</h2>
      <ul>
        {products.payload.map((p, idx) => (
          <li key={idx}>
            {p.sku} — {p.attributes?.item_name || 'Unnamed'}  
          </li>
        ))}
      </ul>
    </div>
  );
}