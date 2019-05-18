import React, { useState, useEffect } from 'react'
import axios from 'axios'
import cn from 'classnames'
import TextField, { Input } from '@material/react-text-field'
import LinearProgress from '@material/react-linear-progress'
import MaterialIcon from '@material/react-material-icon'
import './App.scss'

const API_KEY = process.env.REACT_APP_API_KEY

const api = {
  /**
   * @returns {Promise<{sid: string, response: string}[]>}
   */
  getInvitations: async sids =>
    (await axios.get('/api/invitations', {
      params: { api_key: API_KEY, sids: sids.join(',') }
    })).data,
  /**
   * @typedef {{sid: string, number: string, parsedNumber: string}} QueuedCall
   * @typedef {{error: string, number: string, parsedNumber: string}} FailedCall
   * @returns {Promise<{queued: QueuedCall[], failed: FailedCall[]}>}
   * @throws {Error} if invalid number was given
   */
  inviteBontho: async (numbers, inviter, place) =>
    (await axios.post(
      '/api/invite-bontho',
      {
        numbers,
        inviter,
        place
      },
      { params: { api_key: API_KEY } }
    )).data
}

const passValueTo = setter => e => setter(e.target.value)

const BonthoButton = ({ className, children, onClick }) => (
  <button className={cn('bontho-button', className)} onClick={onClick}>
    {children}
  </button>
)

const NumberSelector = ({ value, onChange, onLockIn }) => {
  const handleClick = () => {
    onLockIn()
  }

  return (
    <>
      <textarea
        className="number-selector__textarea"
        value={value}
        onChange={passValueTo(onChange)}
      />
      <BonthoButton className="number-selector__button" onClick={handleClick}>
        LOCK IN
      </BonthoButton>
    </>
  )
}

const LockedNumbers = ({ numbers }) => {
  return (
    <ul className="locked-numbers">
      {numbers.map(number => (
        <li key={number} className="locked-number">
          <div className="locked-number__number">{number}</div>
        </li>
      ))}
    </ul>
  )
}

const CallerDetails = ({
  className,
  inviter,
  place,
  onInviterChange,
  onPlaceChange,
  onCallsRequested
}) => {
  const handleClick = () => {
    onCallsRequested()
  }

  return (
    <div className={cn('caller-details', className)}>
      <TextField
        className="caller-details__inviter"
        outlined
        label="Who's calling?"
      >
        <Input value={inviter} onChange={passValueTo(onInviterChange)} />
      </TextField>
      <TextField
        className="caller-details__place"
        outlined
        label="Where are you täränting?"
      >
        <Input value={place} onChange={passValueTo(onPlaceChange)} />
      </TextField>
      <BonthoButton className="caller-details__button" onClick={handleClick}>
        START CALLING
      </BonthoButton>
    </div>
  )
}

const noOp = () => {}

const DisabledCallerDetails = ({ inviter, place }) => {
  return (
    <div className="caller-details caller-details--disabled">
      <TextField
        className="caller-details__inviter"
        outlined
        label="Who's calling?"
      >
        <Input value={inviter} onChange={noOp} />
      </TextField>
      <TextField
        className="caller-details__place"
        outlined
        label="Where are you täränting?"
      >
        <Input value={place} onChange={noOp} />
      </TextField>
    </div>
  )
}

const CallStatus = {
  QUEUED: 'QUEUED',
  FAILED: 'FAILED',
  NOT_DOWN: 'DOWN',
  IS_DOWN: 'IS_DOWN'
}

const FailedStatus = () => (
  <div className="call-status call-status--failed">
    <MaterialIcon icon="error_outline" className="call-status__icon" />
    <span className="call-status__text">Error</span>
  </div>
)
const QueuedStatus = () => (
  <div className="call-status call-status--queued">
    <LinearProgress className="call-status__progress" indeterminate />
  </div>
)

const IsDownStatus = () => (
  <div className="call-status call-status--is-down">
    <MaterialIcon icon="thumb_up" className="call-status__icon" />
    <span className="call-status__text">Coming</span>
  </div>
)

const NotDownStatus = () => (
  <div className="call-status call-status--not-down">
    <MaterialIcon icon="thumb_down" className="call-status__icon" />
    <span className="call-status__text">Not coming</span>
  </div>
)

const callStatusElements = {
  [CallStatus.QUEUED]: <QueuedStatus />,
  [CallStatus.FAILED]: <FailedStatus />,
  [CallStatus.IS_DOWN]: <IsDownStatus />,
  [CallStatus.NOT_DOWN]: <NotDownStatus />
}

const LockedNumberStatus = ({ status }) => {
  if (!status) {
    return <div className="locked-number__status" />
  }

  return (
    <div className="locked-number__status">
      {callStatusElements[status.status]}
    </div>
  )
}

const ResultLockedNumbers = ({ numbers, statuses }) => {
  return (
    <ul className="locked-numbers locked-numbers--result">
      {numbers.map(number => (
        <li key={number} className="locked-number">
          <div className="locked-number__number">{number}</div>
          <LockedNumberStatus status={statuses[number]} />
        </li>
      ))}
    </ul>
  )
}

const SectionTitle = ({ children }) => (
  <p className="section-title">{children}</p>
)

const capitalize = str => {
  if (!str || str.length < 1) return str
  const [initial, ...rest] = str
  return [initial.toUpperCase(), ...rest].join('')
}
const isTruthy = val => !!val

function App() {
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)

  const [numberSelectorValue, setNumberSelectorValue] = useState('')
  const chosenNumbers = numberSelectorValue
    .split('\n')
    .map(s => s.trim())
    .filter(isTruthy)
  const [inviter, setInviter] = useState('')
  const [place, setPlace] = useState('')

  const [queuedCalls, setQueuedCalls] = useState([])
  const [failedCalls, setFailedCalls] = useState([])
  const callSids = queuedCalls.map(({ sid }) => sid)
  /**
   * @type {[{sid: string, response: string}[], (invs: any[] => {})]}
   */
  const [invitations, setInvitations] = useState([])

  // poll for updates every 2s if callSids != empty
  useEffect(() => {
    if (callSids.length === 0) {
      return
    }

    const token = setInterval(async () => {
      const invs = await api.getInvitations(callSids)
      setInvitations(invs)
    }, 2000)

    return () => clearInterval(token)
  }, [callSids])

  const numberToSid = queuedCalls.reduce(
    (lookup, { sid, number }) => ({ ...lookup, number: sid }),
    {}
  )

  const numberToCallStatus = chosenNumbers.reduce((acc, number) => {
    // eh O(n^2) is ait
    const queued = queuedCalls.find(call => call.number === number)
    const failed = failedCalls.find(call => call.number === number)
    if (queued) {
      console.log('queued', queued)
      const invitation = invitations.find(inv => inv.sid === queued.sid)
      if (invitation && invitation.response !== null) {
        console.log('invitation', invitation)
        const status =
          invitation.response === 'IS_DOWN'
            ? CallStatus.IS_DOWN
            : invitation.response === 'IS_NOT_DOWN'
            ? CallStatus.NOT_DOWN
            : CallStatus.QUEUED
        return {
          ...acc,
          [number]: { status }
        }
      }
      return {
        ...acc,
        [number]: { status: CallStatus.QUEUED }
      }
    }
    if (failed) {
      return {
        ...acc,
        [number]: { status: CallStatus.FAILED, error: failed.error }
      }
    }
    return acc
  }, {})

  console.log(numberToCallStatus)

  useEffect(() => {
    api
      .getInvitations(['CA6ff43528bbb896bc4f39e06ce7a46bd4'])
      .then(_ => setInvitations(_))
  }, [])

  const handleNumbersLockIn = () => {
    if (chosenNumbers.length === 0) {
      return
    }
    setStep(1)
  }

  const handleCallsRequested = async () => {
    const trimmedInviter = inviter.trim()
    const trimmedPlace = place.trim()

    if (!trimmedInviter || !trimmedPlace) {
      return
    }

    setInviter(trimmedInviter)
    setPlace(trimmedPlace)
    setStep(2)

    try {
      const { queued, failed } = await api.inviteBontho(
        chosenNumbers,
        inviter,
        place
      )
      setQueuedCalls(queued)
      setFailedCalls(failed)
      if (failed.length > 0) {
        setError(`Some calls failed: ${failed.map(_ => _.error).join(', ')}`)
      }
    } catch (e) {
      console.error(e)
      console.error(e.response.data)
      if (e.response && e.response.data) {
        setError(capitalize(e.response.data.error))
        if (e.response.data.error.includes('invalid number')) {
          setStep(0)
        }
      } else {
        setError(e.message)
      }
    }
  }

  return (
    <div className="app">
      <main className="app__main">
        <div className="app__container">
          <h1 className="app__title">täränt bönthö caller 3000</h1>
          {error && <p className="error">{error}</p>}
          {step === 0 && (
            <>
              <SectionTitle>
                1. Insert list of numbers to invite for bönthö
              </SectionTitle>
              <NumberSelector
                value={numberSelectorValue}
                onChange={setNumberSelectorValue}
                onLockIn={handleNumbersLockIn}
              />
            </>
          )}
          {step === 1 && (
            <>
              <SectionTitle>2. Who's calling and where's täränt?</SectionTitle>
              <LockedNumbers numbers={chosenNumbers} />
              <CallerDetails
                inviter={inviter}
                onInviterChange={setInviter}
                place={place}
                onPlaceChange={setPlace}
                onCallsRequested={handleCallsRequested}
              />
            </>
          )}
          {step === 2 && (
            <>
              <SectionTitle>Calling täränters...</SectionTitle>
              <ResultLockedNumbers
                numbers={chosenNumbers}
                statuses={numberToCallStatus}
              />
              <DisabledCallerDetails inviter={inviter} place={place} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
