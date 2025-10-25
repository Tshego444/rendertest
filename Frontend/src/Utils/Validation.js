// Check if value is not empty
export const isRequired = (value) => {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

// Check if email is valid
export const isEmail = (value) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(value)
}

// Check min length
export const minLength = (value, length) => {
  return String(value).trim().length >= length
}

// Check max length
export const maxLength = (value, length) => {
  return String(value).trim().length <= length
}

// Check if number is in range
export const inRange = (value, min, max) => {
  const num = Number(value)
  return !isNaN(num) && num >= min && num <= max
}