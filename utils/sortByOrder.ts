export function sortByOrder<O, I>(order: O[], getID: (item: I) => O) {
  return (a: I, b: I) => {
    const aID = getID(a)
    const bID = getID(b)

    return order.indexOf(aID) - order.indexOf(bID)
  }
}
