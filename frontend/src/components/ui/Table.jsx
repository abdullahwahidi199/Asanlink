export default function Table({ columns, data, rowKey = 'id', empty = null }) {
  if (!data.length && empty) return empty
  const getKey = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey])

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className || ''}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={getKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label} className={column.className || ''}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

